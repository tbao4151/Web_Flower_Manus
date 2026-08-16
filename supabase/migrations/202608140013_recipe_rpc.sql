-- CÁ'S HOA atomic recipe/BOM replacement.

create or replace function public.replace_product_recipe(
  target_product_id uuid,
  target_ingredients jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.products where id = target_product_id) then
    raise exception 'product_not_found';
  end if;

  if jsonb_typeof(target_ingredients) <> 'array' then
    raise exception 'ingredients_must_be_array';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_ingredients) as input(inventory_item_id uuid, quantity_required integer)
    where input.inventory_item_id is null or input.quantity_required is null or input.quantity_required <= 0
  ) then
    raise exception 'invalid_recipe_quantity';
  end if;

  if exists (
    select 1
    from (
      select inventory_item_id, count(*) as item_count
      from jsonb_to_recordset(target_ingredients) as input(inventory_item_id uuid, quantity_required integer)
      group by inventory_item_id
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_recipe_ingredient';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(target_ingredients) as input(inventory_item_id uuid, quantity_required integer)
    left join public.inventory_items ii on ii.id = input.inventory_item_id
    where ii.id is null or ii.is_active = false
  ) then
    raise exception 'inventory_item_not_active';
  end if;

  delete from public.product_ingredients where product_id = target_product_id;

  insert into public.product_ingredients (product_id, inventory_item_id, quantity_required)
  select target_product_id, input.inventory_item_id, input.quantity_required
  from jsonb_to_recordset(target_ingredients) as input(inventory_item_id uuid, quantity_required integer);
end;
$$;

revoke all on function public.replace_product_recipe(uuid, jsonb) from public;
grant execute on function public.replace_product_recipe(uuid, jsonb) to service_role;
