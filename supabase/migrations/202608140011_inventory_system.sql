-- CÁ'S HOA inventory, recipe/BOM, availability, preorder, and atomic reservation migration.
-- Additive only: preserves existing tables, products, orders, and order history.

create type public.sale_mode_type as enum ('ready_stock', 'preorder');
create type public.inventory_transaction_type as enum ('import', 'order', 'damaged', 'adjustment', 'reserve', 'release');

alter table public.products
  add column if not exists sale_mode public.sale_mode_type not null default 'ready_stock',
  add column if not exists preorder_min_hours integer,
  add column if not exists show_when_out_of_stock boolean not null default false;

alter table public.products
  drop constraint if exists products_preorder_min_hours_check;
alter table public.products
  add constraint products_preorder_min_hours_check
  check (preorder_min_hours is null or preorder_min_hours >= 1);

-- The existing settings table is key/value based. The column provides a safe global default,
-- while the inventory row keeps the setting visible to the current Admin settings contract.
alter table public.shop_settings
  add column if not exists low_stock_threshold integer not null default 2;
alter table public.shop_settings
  drop constraint if exists shop_settings_low_stock_threshold_check;
alter table public.shop_settings
  add constraint shop_settings_low_stock_threshold_check
  check (low_stock_threshold >= 0);

insert into public.shop_settings (key, value_json, is_public, low_stock_threshold)
values ('inventory', '{"low_stock_threshold": 2}'::jsonb, false, 2)
on conflict (key) do nothing;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null check (char_length(trim(unit)) between 1 and 30),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0 and quantity_reserved <= quantity_on_hand),
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_required integer not null check (quantity_required > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, inventory_item_id)
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_type public.inventory_transaction_type not null,
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null default '',
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index inventory_items_active_idx on public.inventory_items (is_active, name);
create index product_ingredients_product_idx on public.product_ingredients (product_id);
create index product_ingredients_inventory_idx on public.product_ingredients (inventory_item_id);
create index inventory_transactions_item_created_idx on public.inventory_transactions (inventory_item_id, created_at desc);
create index inventory_transactions_order_idx on public.inventory_transactions (order_id, created_at desc);
create unique index inventory_transactions_one_reserve_idx
  on public.inventory_transactions (order_id, inventory_item_id)
  where transaction_type = 'reserve' and order_id is not null;
create unique index inventory_transactions_one_release_idx
  on public.inventory_transactions (order_id, inventory_item_id)
  where transaction_type = 'release' and order_id is not null;

create or replace function public.inventory_items_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at
before update on public.inventory_items
for each row execute procedure public.inventory_items_set_updated_at();

drop trigger if exists product_ingredients_updated_at on public.product_ingredients;
create trigger product_ingredients_updated_at
before update on public.product_ingredients
for each row execute procedure public.inventory_items_set_updated_at();

-- Exact production capacity is intentionally server-side only. A product without a BOM
-- has zero computable capacity rather than an unsafe unlimited capacity.
create or replace function public.compute_product_availability(target_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    min(floor((ii.quantity_on_hand - ii.quantity_reserved)::numeric / pi.quantity_required)::integer),
    0
  )
  from public.product_ingredients pi
  join public.inventory_items ii on ii.id = pi.inventory_item_id
  where pi.product_id = target_product_id
    and ii.is_active = true;
$$;

-- Reserve only READY_STOCK products. PREORDER products may be confirmed while their
-- current ingredient stock is insufficient and are handled against the shop's lead time.
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

  -- Idempotent retry: an already-reserved order is a successful no-op.
  if exists (
    select 1 from public.inventory_transactions
    where order_id = target_order_id and transaction_type = 'reserve'
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = target_order_id
      and p.sale_mode = 'ready_stock'
      and not exists (
        select 1 from public.product_ingredients pi where pi.product_id = p.id
      )
  ) then
    raise exception 'product_recipe_missing';
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
      inventory_item_id,
      transaction_type,
      quantity_change,
      reason,
      order_id,
      created_by
    ) values (
      requirement.inventory_item_id,
      'reserve',
      requirement.quantity_required,
      'Giữ nguyên liệu cho đơn ' || target_code,
      target_order_id,
      auth.uid()
    );
  end loop;
end;
$$;

create or replace function public.release_stock_for_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_code text;
  requirement record;
  item_row record;
begin
  select order_code
    into target_code
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  -- Idempotent retry: no reserve means there is nothing to release.
  if not exists (
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
    if exists (
      select 1 from public.inventory_transactions
      where order_id = target_order_id
        and inventory_item_id = requirement.inventory_item_id
        and transaction_type = 'release'
    ) then
      continue;
    end if;

    select id, quantity_reserved
      into item_row
    from public.inventory_items
    where id = requirement.inventory_item_id
    for update;

    if not found or item_row.quantity_reserved < requirement.quantity_required then
      raise exception 'reserved_stock_inconsistent:%', requirement.inventory_item_id;
    end if;

    update public.inventory_items
    set quantity_reserved = quantity_reserved - requirement.quantity_required,
        updated_at = now()
    where id = requirement.inventory_item_id;

    insert into public.inventory_transactions (
      inventory_item_id,
      transaction_type,
      quantity_change,
      reason,
      order_id,
      created_by
    ) values (
      requirement.inventory_item_id,
      'release',
      -requirement.quantity_required,
      'Giải phóng nguyên liệu cho đơn ' || target_code,
      target_order_id,
      auth.uid()
    );
  end loop;
end;
$$;

alter table public.inventory_items enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "admins manage inventory items"
  on public.inventory_items for all
  using (public.is_admin())
  with check (public.is_admin());
create policy "staff view inventory items"
  on public.inventory_items for select
  using (public.is_staff_or_admin());

create policy "admins manage product ingredients"
  on public.product_ingredients for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins manage inventory transactions"
  on public.inventory_transactions for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on function public.compute_product_availability(uuid) from public;
revoke all on function public.reserve_stock_for_order(uuid) from public;
revoke all on function public.release_stock_for_order(uuid) from public;
grant execute on function public.compute_product_availability(uuid) to service_role;
grant execute on function public.reserve_stock_for_order(uuid) to service_role;
grant execute on function public.release_stock_for_order(uuid) to service_role;
