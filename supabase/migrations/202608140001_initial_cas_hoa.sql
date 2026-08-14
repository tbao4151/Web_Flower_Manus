create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'staff', 'admin');
create type public.product_type as enum ('bouquet', 'basket');
create type public.product_status as enum ('draft', 'published', 'hidden', 'archived');
create type public.order_status as enum ('pending_confirmation', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  product_type public.product_type not null,
  price_vnd integer not null check (price_vnd >= 0),
  sale_price_vnd integer check (sale_price_vnd is null or (sale_price_vnd >= 0 and sale_price_vnd <= price_vnd)),
  description text not null default '',
  composition text,
  featured boolean not null default false,
  status public.product_status not null default 'draft',
  source_caption text,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  storage_path text not null,
  alt_text text not null default '',
  display_order integer not null default 0 check (display_order >= 0),
  width integer,
  height integer,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table public.color_tones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table public.occasions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table public.product_categories (
  product_id uuid not null references public.products(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (product_id, category_id)
);
create table public.product_tones (
  product_id uuid not null references public.products(id) on delete restrict,
  tone_id uuid not null references public.color_tones(id) on delete restrict,
  primary key (product_id, tone_id)
);
create table public.product_occasions (
  product_id uuid not null references public.products(id) on delete restrict,
  occasion_id uuid not null references public.occasions(id) on delete restrict,
  primary key (product_id, occasion_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null unique,
  customer_name text not null,
  customer_phone text not null,
  recipient_name text not null,
  recipient_phone text not null,
  delivery_address text not null,
  delivery_date date not null,
  delivery_time text not null,
  card_message text not null default '',
  note text not null default '',
  subtotal_vnd integer not null check (subtotal_vnd >= 0),
  shipping_vnd integer not null default 0 check (shipping_vnd >= 0),
  total_vnd integer not null check (total_vnd = subtotal_vnd + shipping_vnd),
  status public.order_status not null default 'pending_confirmation',
  handoff_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_sku_snapshot text not null,
  product_name_snapshot text not null,
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  quantity integer not null check (quantity > 0),
  line_total_vnd integer not null check (line_total_vnd = unit_price_vnd * quantity),
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index products_public_idx on public.products(status, featured, created_at desc);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('staff', 'admin'));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.categories enable row level security;
alter table public.color_tones enable row level security;
alter table public.occasions enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_tones enable row level security;
alter table public.product_occasions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy "public can view published products" on public.products for select using (status = 'published');
create policy "staff and admins manage products" on public.products for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy "public can view published product images" on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "staff and admins manage product images" on public.product_images for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy "public can view catalog taxonomies" on public.categories for select using (true);
create policy "public can view color taxonomies" on public.color_tones for select using (true);
create policy "public can view occasion taxonomies" on public.occasions for select using (true);
create policy "public can view product categories" on public.product_categories for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "public can view product tones" on public.product_tones for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "public can view product occasions" on public.product_occasions for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "users view own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own safe profile fields" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "customers view own orders" on public.orders for select using (user_id = auth.uid());
create policy "staff and admins view orders" on public.orders for select using (public.is_staff_or_admin());
create policy "staff and admins update orders" on public.orders for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());
create policy "customers view own order items" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "staff and admins view order items" on public.order_items for select using (public.is_staff_or_admin());
create policy "customers view own status history" on public.order_status_history for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "staff and admins manage status history" on public.order_status_history for all using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "public can view product image objects" on storage.objects for select using (bucket_id = 'product-images');
create policy "admins can upload product image objects" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins can update product image objects" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
create policy "admins can delete product image objects" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());
