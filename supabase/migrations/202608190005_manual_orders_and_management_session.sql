BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check CHECK (source IN ('website', 'instagram', 'zalo', 'phone', 'in_store', 'other'));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_note text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS orders_source_created_idx ON public.orders (source, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_by_idx ON public.orders (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id, created_at DESC);

CREATE SEQUENCE IF NOT EXISTS public.manual_order_code_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1;

CREATE OR REPLACE FUNCTION public.next_manual_order_code()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CH' || to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYMMDD') || lpad(nextval('public.manual_order_code_seq')::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.next_manual_order_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_manual_order_code() TO service_role;

CREATE OR REPLACE FUNCTION public.create_manual_order(
  target_created_by uuid,
  target_customer_id uuid,
  target_source text,
  target_customer_name text,
  target_customer_phone text,
  target_recipient_name text,
  target_recipient_phone text,
  target_delivery_address text,
  target_delivery_date date,
  target_delivery_time text,
  target_card_message text,
  target_note text,
  target_internal_note text,
  target_shipping_vnd integer,
  target_initial_status public.order_status,
  target_idempotency_key text,
  target_items jsonb
)
RETURNS TABLE(order_id uuid, order_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role public.app_role;
  created_order public.orders;
  item jsonb;
  item_product_id uuid;
  item_name text;
  item_sku text;
  item_unit_price integer;
  item_quantity integer;
  item_line_total integer;
  item_is_custom boolean;
  item_custom_note text;
  subtotal integer := 0;
  next_status public.order_status;
  transition_path public.order_status[];
BEGIN
  SELECT role INTO actor_role
  FROM public.profiles
  WHERE id = target_created_by AND is_active = true;
  IF actor_role IS NULL OR actor_role NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'manual_order_actor_not_authorized';
  END IF;
  IF target_source NOT IN ('instagram', 'zalo', 'phone', 'in_store', 'other') THEN
    RAISE EXCEPTION 'invalid_manual_order_source';
  END IF;
  IF target_recipient_name IS NULL OR char_length(btrim(target_recipient_name)) < 2 THEN RAISE EXCEPTION 'invalid_recipient_name'; END IF;
  IF target_recipient_phone !~ '^0[0-9]{9}$' THEN RAISE EXCEPTION 'invalid_recipient_phone'; END IF;
  IF target_delivery_address IS NULL OR char_length(btrim(target_delivery_address)) < 8 THEN RAISE EXCEPTION 'invalid_delivery_address'; END IF;
  IF target_delivery_date IS NULL OR target_delivery_time IS NULL OR char_length(btrim(target_delivery_time)) = 0 THEN RAISE EXCEPTION 'invalid_delivery_schedule'; END IF;
  IF target_shipping_vnd IS NULL OR target_shipping_vnd < 0 THEN RAISE EXCEPTION 'invalid_shipping_fee'; END IF;
  IF target_idempotency_key IS NULL OR char_length(btrim(target_idempotency_key)) < 12 THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;
  IF target_initial_status NOT IN ('pending_confirmation', 'confirmed', 'preparing', 'ready', 'delivering', 'completed', 'cancelled') THEN RAISE EXCEPTION 'invalid_initial_status'; END IF;
  IF target_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_customer_id) THEN RAISE EXCEPTION 'customer_not_found'; END IF;
  IF target_items IS NULL OR jsonb_typeof(target_items) <> 'array' OR jsonb_array_length(target_items) = 0 THEN RAISE EXCEPTION 'manual_order_items_required'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(target_items)
  LOOP
    item_product_id := NULLIF(item->>'productId', '')::uuid;
    item_name := btrim(COALESCE(item->>'name', ''));
    item_sku := btrim(COALESCE(item->>'sku', 'CUSTOM'));
    item_unit_price := (item->>'unitPriceVnd')::integer;
    item_quantity := (item->>'quantity')::integer;
    item_is_custom := COALESCE((item->>'isCustom')::boolean, false);
    item_custom_note := btrim(COALESCE(item->>'customNote', ''));
    IF item_name = '' OR item_unit_price IS NULL OR item_unit_price < 0 OR item_quantity IS NULL OR item_quantity <= 0 OR item_quantity > 100 THEN RAISE EXCEPTION 'invalid_manual_order_item'; END IF;
    IF NOT item_is_custom AND item_product_id IS NULL THEN RAISE EXCEPTION 'catalog_item_requires_product'; END IF;
    IF item_is_custom THEN item_product_id := NULL; END IF;
    item_line_total := item_unit_price * item_quantity;
    subtotal := subtotal + item_line_total;
  END LOOP;

  INSERT INTO public.orders (order_code, user_id, customer_id, created_by, idempotency_key, source, customer_name, customer_phone, recipient_name, recipient_phone, is_pickup, delivery_method, shipping_fee_confirmed, delivery_status, delivery_address, delivery_date, delivery_time, card_message, note, internal_note, subtotal_vnd, shipping_vnd, total_vnd, status, handoff_summary)
  VALUES (public.next_manual_order_code(), target_customer_id, target_customer_id, target_created_by, target_idempotency_key, target_source, btrim(target_customer_name), target_customer_phone, btrim(target_recipient_name), target_recipient_phone, false, 'delivery', true, 'pending', btrim(target_delivery_address), target_delivery_date, btrim(target_delivery_time), COALESCE(target_card_message, ''), COALESCE(target_note, ''), COALESCE(target_internal_note, ''), subtotal, target_shipping_vnd, subtotal + target_shipping_vnd, 'pending_confirmation', '')
  RETURNING * INTO created_order;

  FOR item IN SELECT value FROM jsonb_array_elements(target_items)
  LOOP
    item_product_id := NULLIF(item->>'productId', '')::uuid;
    item_name := btrim(COALESCE(item->>'name', ''));
    item_sku := btrim(COALESCE(item->>'sku', 'CUSTOM'));
    item_unit_price := (item->>'unitPriceVnd')::integer;
    item_quantity := (item->>'quantity')::integer;
    item_is_custom := COALESCE((item->>'isCustom')::boolean, false);
    item_custom_note := btrim(COALESCE(item->>'customNote', ''));
    IF item_is_custom THEN item_product_id := NULL; END IF;
    INSERT INTO public.order_items (order_id, product_id, product_sku_snapshot, product_name_snapshot, unit_price_vnd, quantity, line_total_vnd, is_custom, custom_note)
    VALUES (created_order.id, item_product_id, item_sku, item_name, item_unit_price, item_quantity, item_unit_price * item_quantity, item_is_custom, item_custom_note);
  END LOOP;

  INSERT INTO public.order_status_history (order_id, to_status, actor_id, note) VALUES (created_order.id, 'pending_confirmation', target_created_by, 'Đơn thủ công được tạo bởi nhân viên.');

  IF target_initial_status <> 'pending_confirmation' THEN
    IF target_initial_status = 'cancelled' THEN transition_path := ARRAY['cancelled'::public.order_status];
    ELSIF target_initial_status = 'confirmed' THEN transition_path := ARRAY['confirmed'::public.order_status];
    ELSIF target_initial_status = 'preparing' THEN transition_path := ARRAY['confirmed'::public.order_status, 'preparing'::public.order_status];
    ELSIF target_initial_status = 'ready' THEN transition_path := ARRAY['confirmed'::public.order_status, 'preparing'::public.order_status, 'ready'::public.order_status];
    ELSIF target_initial_status = 'delivering' THEN transition_path := ARRAY['confirmed'::public.order_status, 'preparing'::public.order_status, 'ready'::public.order_status, 'delivering'::public.order_status];
    ELSE transition_path := ARRAY['confirmed'::public.order_status, 'preparing'::public.order_status, 'ready'::public.order_status, 'delivering'::public.order_status, 'completed'::public.order_status];
    END IF;
    FOREACH next_status IN ARRAY transition_path LOOP
      PERFORM public.transition_order_status(created_order.id, next_status, target_created_by, 'Luồng trạng thái ban đầu của đơn thủ công.');
    END LOOP;
  END IF;

  RETURN QUERY SELECT created_order.id, created_order.order_code;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'manual_order_duplicate';
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_order(uuid, uuid, text, text, text, text, text, text, date, text, text, text, text, integer, public.order_status, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_manual_order(uuid, uuid, text, text, text, text, text, text, date, text, text, text, text, integer, public.order_status, text, jsonb) TO service_role;

DROP POLICY IF EXISTS "customers view linked manual orders" ON public.orders;
CREATE POLICY "customers view linked manual orders" ON public.orders FOR SELECT USING (customer_id = auth.uid());
DROP POLICY IF EXISTS "customers view linked manual order items" ON public.order_items;
CREATE POLICY "customers view linked manual order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));

COMMIT;
