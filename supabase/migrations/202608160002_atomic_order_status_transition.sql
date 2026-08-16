CREATE OR REPLACE FUNCTION public.transition_order_status(
  target_order_id uuid,
  target_status public.order_status,
  target_actor_id uuid,
  target_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.order_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_actor_id
      AND is_active = true
      AND role IN ('staff', 'admin')
  ) THEN
    RAISE EXCEPTION 'order_transition_actor_not_authorized';
  END IF;

  SELECT status
  INTO current_status
  FROM public.orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF NOT (
    (current_status = 'pending_confirmation' AND target_status IN ('confirmed', 'cancelled'))
    OR (current_status = 'confirmed' AND target_status IN ('preparing', 'cancelled'))
    OR (current_status = 'preparing' AND target_status IN ('ready', 'cancelled'))
    OR (current_status = 'ready' AND target_status = 'delivering')
    OR (current_status = 'delivering' AND target_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'invalid_order_transition';
  END IF;

  UPDATE public.orders
  SET status = target_status,
      updated_at = now()
  WHERE id = target_order_id;

  IF target_status = 'confirmed' THEN
    PERFORM public.reserve_stock_for_order(target_order_id);
  ELSIF target_status = 'ready' THEN
    PERFORM public.consume_stock_for_order(target_order_id);
  ELSIF target_status = 'cancelled' THEN
    PERFORM public.release_stock_for_order(target_order_id);
  END IF;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, note)
  VALUES (target_order_id, current_status, target_status, target_actor_id, COALESCE(target_note, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.transition_order_status(uuid, public.order_status, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, public.order_status, uuid, text) TO service_role;

COMMENT ON FUNCTION public.transition_order_status(uuid, public.order_status, uuid, text)
IS 'Atomically updates order status, inventory side effects, and status history.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'transition_order_status'
      AND pg_get_function_identity_arguments(p.oid) = 'target_order_id uuid, target_status order_status, target_actor_id uuid, target_note text'
  ) THEN
    RAISE EXCEPTION 'transition_order_status_verification_failed';
  END IF;
END;
$$;
