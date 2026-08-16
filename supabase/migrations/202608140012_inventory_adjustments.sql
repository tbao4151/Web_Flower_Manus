-- CÁ'S HOA atomic inventory adjustment operations.
-- Additive follow-up to 202608140011; all quantity changes remain transaction-backed.

create or replace function public.adjust_inventory_item(
  target_item_id uuid,
  target_transaction_type public.inventory_transaction_type,
  target_quantity_change integer,
  target_reason text default '',
  target_created_by uuid default auth.uid()
)
returns table (
  id uuid,
  quantity_on_hand integer,
  quantity_reserved integer,
  available_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_item public.inventory_items;
  next_quantity integer;
begin
  if target_transaction_type not in ('import', 'damaged', 'adjustment') then
    raise exception 'invalid_adjustment_type';
  end if;
  if target_quantity_change = 0 then
    raise exception 'quantity_change_required';
  end if;
  if target_transaction_type = 'import' and target_quantity_change < 0 then
    raise exception 'import_must_increase_stock';
  end if;
  if target_transaction_type = 'damaged' and target_quantity_change > 0 then
    raise exception 'damaged_must_decrease_stock';
  end if;

  select * into current_item
  from public.inventory_items
  where inventory_items.id = target_item_id
  for update;

  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  next_quantity := current_item.quantity_on_hand + target_quantity_change;
  if next_quantity < current_item.quantity_reserved then
    raise exception 'stock_below_reserved';
  end if;

  update public.inventory_items
  set quantity_on_hand = next_quantity,
      updated_at = now()
  where inventory_items.id = target_item_id
  returning inventory_items.id, inventory_items.quantity_on_hand, inventory_items.quantity_reserved,
    inventory_items.quantity_on_hand - inventory_items.quantity_reserved
  into id, quantity_on_hand, quantity_reserved, available_quantity;

  insert into public.inventory_transactions (
    inventory_item_id,
    transaction_type,
    quantity_change,
    reason,
    created_by
  ) values (
    target_item_id,
    target_transaction_type,
    target_quantity_change,
    coalesce(nullif(trim(target_reason), ''), 'Cập nhật tồn kho'),
    target_created_by
  );

  return next;
end;
$$;

revoke all on function public.adjust_inventory_item(uuid, public.inventory_transaction_type, integer, text, uuid) from public;
grant execute on function public.adjust_inventory_item(uuid, public.inventory_transaction_type, integer, text, uuid) to service_role;
