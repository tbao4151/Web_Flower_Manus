-- CÁ'S HOA additive migration: public order lookup by recipient phone.
-- Keeps order history intact and adds only lookup support metadata/indexes.

alter table public.order_lookup_audit
  add column if not exists ip_hash text not null default '';

create index if not exists order_lookup_audit_phone_created_idx
  on public.order_lookup_audit (phone_hash, created_at desc);

create index if not exists order_lookup_audit_ip_created_idx
  on public.order_lookup_audit (ip_hash, created_at desc);

alter table public.orders
  add column if not exists recipient_phone_normalized text generated always as (public.normalize_phone(recipient_phone)) stored;

create index if not exists orders_recipient_phone_normalized_created_idx
  on public.orders (recipient_phone_normalized, created_at desc);
