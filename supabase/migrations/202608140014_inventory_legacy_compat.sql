-- Keep the inventory feature additive for existing products that do not yet have an Admin BOM.
-- Once a BOM exists, READY_STOCK products participate fully in atomic reservation.

create or replace function public.reserve_stock_for_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_status public.order_status;
  target_code text;
  requirement record;
  item_row record;
begin
  select status, order_code
    into target_status, target_code
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if target_status <> 'confirmed' then
    raise exception 'order_not_confirmed';
  end if;

  if exists (
    select 1 from public.inventory_transactions
    where order_id = target_order_id and transaction_type = 'reserve'
  ) then
    return;
  end if;

  for requirement in
    select pi.inventory_item_id,
           sum(pi.quantity_required * oi.quantity)::integer as quantity_required
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.product_ingredients pi on pi.product_id = p.id
    where oi.order_id = target_order_id
      and p.sale_mode = 'ready_stock'
    group by pi.inventory_item_id
    order by pi.inventory_item_id
  loop
    select id, quantity_on_hand, quantity_reserved
      into item_row
    from public.inventory_items
    where id = requirement.inventory_item_id
    for update;

    if not found or (item_row.quantity_on_hand - item_row.quantity_reserved) < requirement.quantity_required then
      raise exception 'insufficient_stock:%', requirement.inventory_item_id;
    end if;

    update public.inventory_items
    set quantity_reserved = quantity_reserved + requirement.quantity_required,
        updated_at = now()
    where id = requirement.inventory_item_id;

    insert into public.inventory_transactions (
      inventory_item_id, transaction_type, quantity_change, reason, order_id, created_by
    ) values (
      requirement.inventory_item_id, 'reserve', requirement.quantity_required,
      'Giữ nguyên liệu cho đơn ' || target_code, target_order_id, auth.uid()
    );
  end loop;
end;
$$;

revoke all on function public.reserve_stock_for_order(uuid) from public;
grant execute on function public.reserve_stock_for_order(uuid) to service_role;
