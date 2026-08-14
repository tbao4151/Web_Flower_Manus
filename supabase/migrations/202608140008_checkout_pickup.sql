-- Checkout enhancement: customers may collect orders at the shop instead of entering a delivery address.
-- Existing delivery orders remain unchanged and continue to require an address.

alter table public.orders
  add column if not exists is_pickup boolean not null default false;

alter table public.orders
  alter column delivery_address drop not null;

alter table public.orders
  drop constraint if exists orders_delivery_address_required_for_delivery;

alter table public.orders
  add constraint orders_delivery_address_required_for_delivery
  check (is_pickup = true or nullif(trim(delivery_address), '') is not null);

create index if not exists orders_pickup_idx
  on public.orders (is_pickup, created_at desc);
