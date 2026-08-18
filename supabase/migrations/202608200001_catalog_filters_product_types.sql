-- CÁ'S HOA: database-backed product types and public catalog price-filter configuration.
-- Additive and forward-only. Existing products, relations, order history, and images are preserved.

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.product_types (name, slug, display_order)
values ('Bó hoa', 'bouquet', 10), ('Giỏ hoa', 'basket', 20)
on conflict (slug) do nothing;

-- Bring legacy taxonomy tables to the same safe lifecycle model.
alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.categories add column if not exists display_order integer not null default 0 check (display_order >= 0);
alter table public.categories add column if not exists updated_at timestamptz not null default now();
alter table public.color_tones add column if not exists is_active boolean not null default true;
alter table public.color_tones add column if not exists display_order integer not null default 0 check (display_order >= 0);
alter table public.color_tones add column if not exists updated_at timestamptz not null default now();
alter table public.occasions add column if not exists is_active boolean not null default true;
alter table public.occasions add column if not exists display_order integer not null default 0 check (display_order >= 0);
alter table public.occasions add column if not exists updated_at timestamptz not null default now();

create index if not exists categories_active_order_idx on public.categories (is_active, display_order, name);
create index if not exists color_tones_active_order_idx on public.color_tones (is_active, display_order, name);
create index if not exists occasions_active_order_idx on public.occasions (is_active, display_order, name);

-- Convert the original enum-backed product_type column to a validated text FK so
-- Admin can manage the active catalog type list without future enum migrations.
alter table public.products add column if not exists product_type_slug text;
update public.products set product_type_slug = product_type::text where product_type_slug is null;
alter table public.products alter column product_type_slug set not null;
alter table public.products drop column if exists product_type;
alter table public.products rename column product_type_slug to product_type;
alter table public.products add constraint products_product_type_fkey
  foreign key (product_type) references public.product_types(slug)
  on update cascade on delete restrict;

create index if not exists product_types_active_order_idx
  on public.product_types (is_active, display_order, name);
create index if not exists products_product_type_idx
  on public.products (product_type);

alter table public.product_types enable row level security;
create policy "public can view active product types" on public.product_types
  for select using (is_active = true);
create policy "admins manage product types" on public.product_types
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists product_types_updated_at on public.product_types;
create trigger product_types_updated_at
before update on public.product_types
for each row execute procedure public.set_updated_at();

insert into public.shop_settings (key, value_json, is_public)
values
  ('catalog_filters', '{"price_max_vnd": 1500000, "price_step_vnd": 50000}'::jsonb, true)
on conflict (key) do nothing;
