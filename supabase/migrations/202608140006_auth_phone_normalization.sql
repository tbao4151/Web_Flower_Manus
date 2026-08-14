-- CÁ'S HOA V2.1 additive phone-auth fix.
-- Keeps customer-facing/profile phone values in local 0XXXXXXXXX format while
-- Supabase Auth receives E.164 values from the application server.

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  with cleaned as (
    select regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') as value
  )
  select case
    when value like '+84%' then '0' || substring(value from 4)
    when value like '84%' and length(value) = 11 then '0' || substring(value from 3)
    else value
  end
  from cleaned;
$$;

alter table public.profiles
  alter column full_name drop not null;

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
    nullif(public.normalize_phone(new.phone), ''),
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

 drop trigger if exists on_auth_user_created on auth.users;
 create trigger on_auth_user_created
 after insert on auth.users
 for each row execute procedure public.handle_new_user();
