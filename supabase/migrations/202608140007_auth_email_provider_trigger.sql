-- Internal email auth migration for phone + password UX.
-- The public phone number is stored in raw_user_meta_data and mirrored to profiles.
-- Native Supabase Phone Auth is intentionally not used by the application.

create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role, is_active)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(public.normalize_phone(new.raw_user_meta_data ->> 'phone'), ''),
    'customer',
    true
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
