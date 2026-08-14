-- CÁ'S HOA V2.1 additive migration.
-- Safe to apply after 202608140003. Does not reset data or delete order history.

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g');
$$;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

alter table public.products
  add column if not exists archived_at timestamptz;

alter table public.product_images
  add column if not exists is_cover boolean not null default false;

alter table public.orders
  alter column customer_name drop not null,
  alter column customer_phone drop not null;

create index if not exists orders_recipient_lookup_idx
  on public.orders (order_code, recipient_phone);

create table if not exists public.shop_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.order_lookup_audit (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  phone_hash text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists order_lookup_audit_created_idx
  on public.order_lookup_audit (created_at desc);

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.phone, ''),
    'customer'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Prevent customers from changing their own role or activation state.
drop policy if exists "users update own safe profile fields" on public.profiles;
create policy "users update own safe profile fields" on public.profiles
for update using (id = auth.uid())
with check (
  id = auth.uid()
  and role = public.current_user_role()
  and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
);

create policy "admins manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

create policy "staff view operational profiles" on public.profiles
for select using (public.is_staff_or_admin());

create policy "public can view public shop settings" on public.shop_settings
for select using (is_public = true);

create policy "admins manage shop settings" on public.shop_settings
for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage product image records" on public.product_images
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff and admins manage product images" on public.product_images;

alter table public.shop_settings enable row level security;
alter table public.order_lookup_audit enable row level security;

-- Only server-side service-role code writes lookup audit records.
create policy "staff and admins view lookup audit" on public.order_lookup_audit
for select using (public.is_staff_or_admin());

insert into public.shop_settings (key, value_json, is_public)
values
  ('announcement', '{"enabled": false, "text": ""}'::jsonb, true),
  ('contact', '{"instagram": "https://www.instagram.com/nfishtt_flower/", "zalo": "https://zalo.me/0356925367"}'::jsonb, true),
  ('delivery', '{"shipping_policy": "Shop xác nhận phí giao sau khi nhận đơn."}'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_settings_updated_at on public.shop_settings;
create trigger shop_settings_updated_at
before update on public.shop_settings
for each row execute procedure public.set_updated_at();

-- Cover image is represented by the lowest display order; keep the explicit field for admin UI.
update public.product_images pi
set is_cover = true
where pi.display_order = (
  select min(pi2.display_order)
  from public.product_images pi2
  where pi2.product_id = pi.product_id
)
and not exists (
  select 1 from public.product_images existing
  where existing.product_id = pi.product_id and existing.is_cover
);

create index if not exists product_images_cover_idx
  on public.product_images (product_id, is_cover, display_order);
