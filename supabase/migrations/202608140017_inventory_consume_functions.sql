-- CÁ'S HOA additive inventory workflow hardening.
-- Adds consume transactions and keeps every stock mutation atomic/idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS inventory_transactions_one_consume_idx
  ON public.inventory_transactions (order_id, inventory_item_id)
  WHERE transaction_type = 'consume' AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.adjust_inventory_item(
  target_item_id uuid,
  target_transaction_type public.inventory_transaction_type,
  target_quantity_change integer,
  target_reason text default '',
  target_created_by uuid default auth.uid(),
  target_note text default ''
)
RETURNS TABLE (
  id uuid,
  quantity_on_hand integer,
  quantity_reserved integer,
  available_quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_item public.inventory_items;
  next_quantity integer;
  before_available integer;
  after_available integer;
BEGIN
  IF target_transaction_type NOT IN ('import', 'damaged', 'adjustment') THEN
    RAISE EXCEPTION 'invalid_adjustment_type';
  END IF;
  IF target_quantity_change = 0 THEN
    RAISE EXCEPTION 'quantity_change_required';
  END IF;
  IF target_transaction_type = 'import' AND target_quantity_change < 0 THEN
    RAISE EXCEPTION 'import_must_increase_stock';
  END IF;
  IF target_transaction_type = 'damaged' AND target_quantity_change > 0 THEN
    RAISE EXCEPTION 'damaged_must_decrease_stock';
  END IF;

  SELECT * INTO current_item
  FROM public.inventory_items
  WHERE inventory_items.id = target_item_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_item_not_found'; END IF;
  before_available := current_item.quantity_on_hand - current_item.quantity_reserved;
  next_quantity := current_item.quantity_on_hand + target_quantity_change;
  IF next_quantity < current_item.quantity_reserved THEN RAISE EXCEPTION 'stock_below_reserved'; END IF;
  after_available := next_quantity - current_item.quantity_reserved;

  UPDATE public.inventory_items
  SET quantity_on_hand = next_quantity, updated_at = now()
  WHERE inventory_items.id = target_item_id
  RETURNING inventory_items.id, inventory_items.quantity_on_hand, inventory_items.quantity_reserved,
    inventory_items.quantity_on_hand - inventory_items.quantity_reserved
  INTO id, quantity_on_hand, quantity_reserved, available_quantity;

  INSERT INTO public.inventory_transactions (
    inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after,
    reason, note, created_by
  ) VALUES (
    target_item_id, target_transaction_type, target_quantity_change, before_available, after_available,
    COALESCE(NULLIF(trim(target_reason), ''), 'Cập nhật tồn kho'), COALESCE(target_note, ''), target_created_by
  );

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(target_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_status public.order_status;
  target_code text;
  requirement record;
  item_row record;
  before_available integer;
  after_available integer;
BEGIN
  SELECT status, order_code INTO target_status, target_code
  FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF target_status <> 'confirmed' THEN RAISE EXCEPTION 'order_not_confirmed'; END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE order_id = target_order_id AND transaction_type = 'reserve') THEN
    RETURN;
  END IF;

  FOR requirement IN
    SELECT pi.inventory_item_id, sum(pi.quantity_required * oi.quantity)::integer AS quantity_required
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.product_ingredients pi ON pi.product_id = p.id
    WHERE oi.order_id = target_order_id AND p.sale_mode = 'ready_stock'
    GROUP BY pi.inventory_item_id
    ORDER BY pi.inventory_item_id
  LOOP
    SELECT id, quantity_on_hand, quantity_reserved INTO item_row
    FROM public.inventory_items WHERE id = requirement.inventory_item_id FOR UPDATE;
    IF NOT FOUND OR (item_row.quantity_on_hand - item_row.quantity_reserved) < requirement.quantity_required THEN
      RAISE EXCEPTION 'insufficient_stock:%', requirement.inventory_item_id;
    END IF;

    before_available := item_row.quantity_on_hand - item_row.quantity_reserved;
    after_available := before_available - requirement.quantity_required;
    UPDATE public.inventory_items
    SET quantity_reserved = quantity_reserved + requirement.quantity_required, updated_at = now()
    WHERE id = requirement.inventory_item_id;

    INSERT INTO public.inventory_transactions (
      inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after,
      reason, order_id, note, created_by
    ) VALUES (
      requirement.inventory_item_id, 'reserve', -requirement.quantity_required, before_available, after_available,
      'Giữ nguyên liệu cho đơn ' || target_code, target_order_id, 'ORDER_RESERVE', auth.uid()
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock_for_order(target_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_code text;
  requirement record;
  item_row record;
  before_available integer;
  after_available integer;
BEGIN
  SELECT order_code INTO target_code FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE order_id = target_order_id AND transaction_type = 'reserve') THEN RETURN; END IF;

  FOR requirement IN
    SELECT pi.inventory_item_id, sum(pi.quantity_required * oi.quantity)::integer AS quantity_required
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.product_ingredients pi ON pi.product_id = p.id
    WHERE oi.order_id = target_order_id AND p.sale_mode = 'ready_stock'
    GROUP BY pi.inventory_item_id
    ORDER BY pi.inventory_item_id
  LOOP
    IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE order_id = target_order_id AND inventory_item_id = requirement.inventory_item_id AND transaction_type = 'release') THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE order_id = target_order_id AND inventory_item_id = requirement.inventory_item_id AND transaction_type = 'consume') THEN CONTINUE; END IF;

    SELECT id, quantity_on_hand, quantity_reserved INTO item_row
    FROM public.inventory_items WHERE id = requirement.inventory_item_id FOR UPDATE;
    IF NOT FOUND OR item_row.quantity_reserved < requirement.quantity_required THEN RAISE EXCEPTION 'reserved_stock_inconsistent:%', requirement.inventory_item_id; END IF;

    before_available := item_row.quantity_on_hand - item_row.quantity_reserved;
    after_available := before_available + requirement.quantity_required;
    UPDATE public.inventory_items
    SET quantity_reserved = quantity_reserved - requirement.quantity_required, updated_at = now()
    WHERE id = requirement.inventory_item_id;

    INSERT INTO public.inventory_transactions (
      inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after,
      reason, order_id, note, created_by
    ) VALUES (
      requirement.inventory_item_id, 'release', requirement.quantity_required, before_available, after_available,
      'Giải phóng nguyên liệu cho đơn ' || target_code, target_order_id, 'ORDER_RELEASE', auth.uid()
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_stock_for_order(target_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_status public.order_status;
  target_code text;
  requirement record;
  item_row record;
  before_available integer;
  after_available integer;
BEGIN
  SELECT status, order_code INTO target_status, target_code
  FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF target_status NOT IN ('ready', 'delivering', 'completed') THEN RAISE EXCEPTION 'order_not_ready_to_consume'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE order_id = target_order_id AND transaction_type = 'reserve') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_transactions WHERE order_id = target_order_id AND transaction_type = 'consume') THEN RETURN; END IF;

  FOR requirement IN
    SELECT pi.inventory_item_id, sum(pi.quantity_required * oi.quantity)::integer AS quantity_required
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.product_ingredients pi ON pi.product_id = p.id
    WHERE oi.order_id = target_order_id AND p.sale_mode = 'ready_stock'
    GROUP BY pi.inventory_item_id
    ORDER BY pi.inventory_item_id
  LOOP
    SELECT id, quantity_on_hand, quantity_reserved INTO item_row
    FROM public.inventory_items WHERE id = requirement.inventory_item_id FOR UPDATE;
    IF NOT FOUND OR item_row.quantity_reserved < requirement.quantity_required OR item_row.quantity_on_hand < requirement.quantity_required THEN
      RAISE EXCEPTION 'reserved_stock_inconsistent:%', requirement.inventory_item_id;
    END IF;

    before_available := item_row.quantity_on_hand - item_row.quantity_reserved;
    after_available := before_available;
    UPDATE public.inventory_items
    SET quantity_reserved = quantity_reserved - requirement.quantity_required,
        quantity_on_hand = quantity_on_hand - requirement.quantity_required,
        updated_at = now()
    WHERE id = requirement.inventory_item_id;

    INSERT INTO public.inventory_transactions (
      inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after,
      reason, order_id, note, created_by
    ) VALUES (
      requirement.inventory_item_id, 'consume', -requirement.quantity_required, before_available, after_available,
      'Sử dụng nguyên liệu cho đơn ' || target_code, target_order_id, 'ORDER_CONSUME', auth.uid()
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_inventory_item(uuid, public.inventory_transaction_type, integer, text, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.reserve_stock_for_order(uuid) FROM public;
REVOKE ALL ON FUNCTION public.release_stock_for_order(uuid) FROM public;
REVOKE ALL ON FUNCTION public.consume_stock_for_order(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_item(uuid, public.inventory_transaction_type, integer, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stock_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_stock_for_order(uuid) TO service_role;
