-- Homepage HERO featured slots. Additive and safe for the existing product catalog.
alter table public.products
  add column if not exists featured_position integer;

alter table public.products
  drop constraint if exists products_featured_position_check;

alter table public.products
  add constraint products_featured_position_check
  check (featured_position is null or featured_position in (1, 2, 3));

create unique index if not exists products_featured_position_unique_idx
  on public.products (featured_position)
  where featured_position is not null;

create index if not exists products_featured_position_public_idx
  on public.products (status, featured_position)
  where featured_position is not null;

create or replace function public.set_homepage_featured_slots(
  position_one uuid default null,
  position_two uuid default null,
  position_three uuid default null
)
returns table (
  featured_position integer,
  product_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_ids uuid[] := array_remove(array[position_one, position_two, position_three], null);
  selected_count integer;
begin
  -- Authorization is enforced by the protected server API before it invokes
  -- this service_role-only function. The RPC itself must not inspect auth.uid(),
  -- because service-role requests intentionally have no end-user JWT.
  select count(distinct selected_id) into selected_count
  from unnest(selected_ids) as selected_id;

  if selected_count <> cardinality(selected_ids) then
    raise exception 'featured_product_duplicate';
  end if;

  if cardinality(selected_ids) > 0 and exists (
    select 1
    from public.products p
    where p.id = any(selected_ids)
      and (
        p.status <> 'published'
        or not exists (
          select 1 from public.product_images pi
          where pi.product_id = p.id
        )
      )
  ) then
    raise exception 'featured_product_invalid';
  end if;

  -- Clear all slots first so an admin can swap positions atomically without
  -- colliding with the unique partial index.
  update public.products as p
  set featured_position = null,
      updated_at = now()
  where p.featured_position is not null;

  update public.products as p set featured_position = 1, updated_at = now() where p.id = position_one;
  update public.products as p set featured_position = 2, updated_at = now() where p.id = position_two;
  update public.products as p set featured_position = 3, updated_at = now() where p.id = position_three;

  return query
    select p.featured_position, p.id
    from public.products p
    where p.featured_position is not null
    order by p.featured_position;
end;
$$;

revoke all on function public.set_homepage_featured_slots(uuid, uuid, uuid) from public;
grant execute on function public.set_homepage_featured_slots(uuid, uuid, uuid) to service_role;
