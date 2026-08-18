-- Extend the existing atomic manual adjustment RPC with an explicit export operation.
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
  IF target_transaction_type NOT IN ('import', 'export', 'damaged', 'adjustment') THEN
    RAISE EXCEPTION 'invalid_adjustment_type';
  END IF;
  IF target_quantity_change = 0 THEN
    RAISE EXCEPTION 'quantity_change_required';
  END IF;
  IF target_transaction_type = 'import' AND target_quantity_change < 0 THEN
    RAISE EXCEPTION 'import_must_increase_stock';
  END IF;
  IF target_transaction_type IN ('export', 'damaged') AND target_quantity_change > 0 THEN
    RAISE EXCEPTION 'stock_out_must_decrease_stock';
  END IF;

  SELECT * INTO current_item
  FROM public.inventory_items
  WHERE inventory_items.id = target_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_item_not_found';
  END IF;

  before_available := current_item.quantity_on_hand - current_item.quantity_reserved;
  next_quantity := current_item.quantity_on_hand + target_quantity_change;
  IF next_quantity < current_item.quantity_reserved THEN
    RAISE EXCEPTION 'stock_below_reserved';
  END IF;
  after_available := next_quantity - current_item.quantity_reserved;

  UPDATE public.inventory_items
  SET quantity_on_hand = next_quantity,
      updated_at = now()
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

REVOKE ALL ON FUNCTION public.adjust_inventory_item(uuid, public.inventory_transaction_type, integer, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_item(uuid, public.inventory_transaction_type, integer, text, uuid, text) TO service_role;
