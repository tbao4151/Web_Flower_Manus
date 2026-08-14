-- CÁ'S HOA V2.1 compliance additions. Safe and incremental: no data reset or destructive catalog replacement.

alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.categories add column if not exists display_order integer not null default 0;
alter table public.color_tones add column if not exists is_active boolean not null default true;
alter table public.color_tones add column if not exists display_order integer not null default 0;
alter table public.occasions add column if not exists is_active boolean not null default true;
alter table public.occasions add column if not exists display_order integer not null default 0;

create index if not exists categories_active_order_idx on public.categories (is_active, display_order, name);
create index if not exists color_tones_active_order_idx on public.color_tones (is_active, display_order, name);
create index if not exists occasions_active_order_idx on public.occasions (is_active, display_order, name);

drop policy if exists "public can view catalog taxonomies" on public.categories;
create policy "public can view active catalog taxonomies" on public.categories for select using (is_active = true or public.is_admin());
drop policy if exists "public can view color taxonomies" on public.color_tones;
create policy "public can view active color taxonomies" on public.color_tones for select using (is_active = true or public.is_admin());
drop policy if exists "public can view occasion taxonomies" on public.occasions;
create policy "public can view active occasion taxonomies" on public.occasions for select using (is_active = true or public.is_admin());

create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage color tones" on public.color_tones for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage occasions" on public.occasions for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage product categories" on public.product_categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage product tones" on public.product_tones for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage product occasions" on public.product_occasions for all using (public.is_admin()) with check (public.is_admin());

create index if not exists products_slug_public_idx on public.products (slug, status);
create index if not exists products_search_idx on public.products using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '')));
