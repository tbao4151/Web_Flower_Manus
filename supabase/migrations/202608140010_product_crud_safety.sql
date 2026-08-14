-- CÁ'S HOA product CRUD safety migration.
-- Keeps order history intact and separates archive/hide from permanent deletion.

create unique index if not exists product_images_one_cover_idx
  on public.product_images (product_id)
  where is_cover = true;

create or replace function public.permanently_delete_product(target_product_id uuid)
returns table(storage_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.products where id = target_product_id) then
    raise exception 'product_not_found';
  end if;

  if exists (select 1 from public.order_items where product_id = target_product_id) then
    raise exception 'product_has_orders';
  end if;

  return query
    select pi.storage_path
    from public.product_images pi
    where pi.product_id = target_product_id;

  delete from public.product_categories where product_id = target_product_id;
  delete from public.product_tones where product_id = target_product_id;
  delete from public.product_occasions where product_id = target_product_id;
  delete from public.product_images where product_id = target_product_id;
  delete from public.products where id = target_product_id;
end;
$$;

revoke all on function public.permanently_delete_product(uuid) from public;
grant execute on function public.permanently_delete_product(uuid) to service_role;
