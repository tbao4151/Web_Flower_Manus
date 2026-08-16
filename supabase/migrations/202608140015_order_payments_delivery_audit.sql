-- CÁ'S HOA additive order payments, delivery workflow, and inventory audit metadata.
-- No existing data is deleted and the current order snapshot contract remains intact.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_type') THEN
    CREATE TYPE public.payment_status_type AS ENUM ('unpaid', 'partially_paid', 'paid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE public.payment_method_type AS ENUM ('bank_transfer', 'cash', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_method_type') THEN
    CREATE TYPE public.delivery_method_type AS ENUM ('delivery', 'pickup');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status_type') THEN
    CREATE TYPE public.delivery_status_type AS ENUM ('pending', 'assigned', 'out_for_delivery', 'delivered', 'pickup_ready', 'picked_up', 'failed');
  END IF;
END
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method public.delivery_method_type NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS deposit_required_vnd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_vnd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount_vnd integer GENERATED ALWAYS AS (total_vnd - deposit_paid_vnd) STORED,
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status_type NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS shipping_fee_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_status public.delivery_status_type NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS shipper_name text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_note text NOT NULL DEFAULT '';

UPDATE public.orders
SET delivery_method = CASE WHEN is_pickup THEN 'pickup'::public.delivery_method_type ELSE 'delivery'::public.delivery_method_type END
WHERE delivery_method = 'delivery'::public.delivery_method_type AND is_pickup = true;

UPDATE public.orders
SET shipping_fee_confirmed = false
WHERE shipping_vnd = 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_deposit_required_check,
  DROP CONSTRAINT IF EXISTS orders_deposit_paid_check,
  DROP CONSTRAINT IF EXISTS orders_deposit_not_over_total_check,
  DROP CONSTRAINT IF EXISTS orders_delivery_shipping_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_deposit_required_check CHECK (deposit_required_vnd >= 0 AND deposit_required_vnd <= total_vnd),
  ADD CONSTRAINT orders_deposit_paid_check CHECK (deposit_paid_vnd >= 0),
  ADD CONSTRAINT orders_deposit_not_over_total_check CHECK (deposit_paid_vnd <= total_vnd),
  ADD CONSTRAINT orders_delivery_shipping_check CHECK (delivery_method <> 'pickup' OR (is_pickup = true AND shipping_vnd = 0));

CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_delivery_date_idx ON public.orders (delivery_date, delivery_status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders (payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_vnd integer NOT NULL CHECK (amount_vnd > 0),
  payment_method public.payment_method_type NOT NULL DEFAULT 'other',
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_payments_order_paid_idx ON public.order_payments (order_id, paid_at DESC);

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS quantity_before integer,
  ADD COLUMN IF NOT EXISTS quantity_after integer,
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

ALTER TABLE public.inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_quantity_before_check,
  DROP CONSTRAINT IF EXISTS inventory_transactions_quantity_after_check;

ALTER TABLE public.inventory_transactions
  ADD CONSTRAINT inventory_transactions_quantity_before_check CHECK (quantity_before IS NULL OR quantity_before >= 0),
  ADD CONSTRAINT inventory_transactions_quantity_after_check CHECK (quantity_after IS NULL OR quantity_after >= 0);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff view order payments" ON public.order_payments;
CREATE POLICY "staff view order payments"
  ON public.order_payments FOR SELECT
  USING (public.is_staff_or_admin());

DROP POLICY IF EXISTS "admins manage order payments" ON public.order_payments;
CREATE POLICY "admins manage order payments"
  ON public.order_payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff view inventory transactions" ON public.inventory_transactions;
CREATE POLICY "staff view inventory transactions"
  ON public.inventory_transactions FOR SELECT
  USING (public.is_staff_or_admin());

CREATE OR REPLACE FUNCTION public.recalculate_order_payment_status(target_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.orders;
  next_status public.payment_status_type;
BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  next_status := CASE
    WHEN current_order.deposit_paid_vnd <= 0 THEN 'unpaid'::public.payment_status_type
    WHEN current_order.deposit_paid_vnd >= current_order.total_vnd THEN 'paid'::public.payment_status_type
    ELSE 'partially_paid'::public.payment_status_type
  END;
  UPDATE public.orders SET payment_status = next_status, updated_at = now() WHERE id = target_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_payment(
  target_order_id uuid,
  target_amount_vnd integer,
  target_payment_method public.payment_method_type,
  target_paid_at timestamptz,
  target_note text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.orders;
  updated_order public.orders;
BEGIN
  IF target_amount_vnd IS NULL OR target_amount_vnd <= 0 THEN RAISE EXCEPTION 'invalid_payment_amount'; END IF;
  SELECT * INTO current_order FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF current_order.deposit_paid_vnd + target_amount_vnd > current_order.total_vnd THEN
    RAISE EXCEPTION 'payment_exceeds_total';
  END IF;

  INSERT INTO public.order_payments (order_id, amount_vnd, payment_method, paid_at, note, created_by)
  VALUES (target_order_id, target_amount_vnd, COALESCE(target_payment_method, 'other'::public.payment_method_type), COALESCE(target_paid_at, now()), COALESCE(target_note, ''), auth.uid());

  UPDATE public.orders
  SET deposit_paid_vnd = deposit_paid_vnd + target_amount_vnd,
      payment_status = CASE
        WHEN deposit_paid_vnd + target_amount_vnd >= total_vnd THEN 'paid'::public.payment_status_type
        ELSE 'partially_paid'::public.payment_status_type
      END,
      updated_at = now()
  WHERE id = target_order_id
  RETURNING * INTO updated_order;

  RETURN updated_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_shipping(
  target_order_id uuid,
  target_shipping_vnd integer,
  target_fee_confirmed boolean,
  target_carrier_name text,
  target_shipper_name text,
  target_estimated_delivery_at timestamptz,
  target_note text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.orders;
  updated_order public.orders;
  next_shipping integer;
BEGIN
  SELECT * INTO current_order FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  next_shipping := CASE WHEN current_order.is_pickup THEN 0 ELSE GREATEST(COALESCE(target_shipping_vnd, 0), 0) END;
  IF current_order.deposit_paid_vnd > current_order.subtotal_vnd + next_shipping THEN
    RAISE EXCEPTION 'payment_exceeds_total';
  END IF;

  UPDATE public.orders
  SET shipping_vnd = next_shipping,
      total_vnd = subtotal_vnd + next_shipping,
      shipping_fee_confirmed = CASE WHEN current_order.is_pickup THEN true ELSE COALESCE(target_fee_confirmed, false) END,
      carrier_name = NULLIF(trim(COALESCE(target_carrier_name, '')), ''),
      shipper_name = NULLIF(trim(COALESCE(target_shipper_name, '')), ''),
      estimated_delivery_at = target_estimated_delivery_at,
      internal_note = CASE WHEN COALESCE(target_note, '') = '' THEN internal_note ELSE target_note END,
      updated_at = now()
  WHERE id = target_order_id
  RETURNING * INTO updated_order;

  PERFORM public.recalculate_order_payment_status(target_order_id);
  SELECT * INTO updated_order FROM public.orders WHERE id = target_order_id;
  RETURN updated_order;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_order_payment_status(uuid) FROM public;
REVOKE ALL ON FUNCTION public.record_order_payment(uuid, integer, public.payment_method_type, timestamptz, text) FROM public;
REVOKE ALL ON FUNCTION public.update_order_shipping(uuid, integer, boolean, text, text, timestamptz, text) FROM public;
GRANT EXECUTE ON FUNCTION public.recalculate_order_payment_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, integer, public.payment_method_type, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_order_shipping(uuid, integer, boolean, text, text, timestamptz, text) TO service_role;
