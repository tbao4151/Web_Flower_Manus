-- CÁ'S HOA Auth rebuild: real Gmail identities, optional phone for Google onboarding,
-- database-enforced phone format, and a hook function for Gmail-only signup policy.
-- This migration does not create users, promote roles, or alter business/order data.

create or replace function public.is_gmail_email(input text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(input, ''))) ~ '^[^@[:space:]]+@gmail[.]com$';
$$;

create or replace function public.normalize_gmail(input text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(input, '')));
$$;

-- Keep the existing helper useful for internal comparisons and order lookup.
-- Public Auth routes enforce the stricter 0xxxxxxxxx format before writing profiles.
create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') ~ '^\\+84[0-9]{9}$'
      then '0' || substring(regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') from 4)
    when regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') ~ '^84[0-9]{9}$'
      then '0' || substring(regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') from 3)
    else regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g')
  end;
$$;

alter table public.profiles
  drop constraint if exists profiles_phone_format_check;

alter table public.profiles
  add constraint profiles_phone_format_check
  check (phone is null or phone ~ '^0[0-9]{9}$');

create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_phone text;
  canonical_phone text;
begin
  raw_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  canonical_phone := case
    when raw_phone ~ '^0[0-9]{9}$' then raw_phone
    else null
  end;

  insert into public.profiles (id, full_name, phone, role, is_active)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    canonical_phone,
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
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Supabase Auth Before User Created hook target. Configure this function in the
-- Dashboard after applying the migration; the hook blocks non-Gmail identities
-- before auth.users insertion. Google signups may omit phone for onboarding.
create or replace function public.hook_restrict_cas_hoa_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
  provider text := lower(coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', ''));
  phone text := trim(coalesce(event -> 'user' -> 'user_metadata' ->> 'phone', ''));
begin
  if not public.is_gmail_email(email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'CÁ''S HOA chỉ chấp nhận địa chỉ Gmail @gmail.com.'
      )
    );
  end if;

  if provider = 'email' and phone !~ '^0[0-9]{9}$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_restrict_cas_hoa_signup(jsonb) from public;
grant execute on function public.hook_restrict_cas_hoa_signup(jsonb) to supabase_auth_admin;

comment on function public.hook_restrict_cas_hoa_signup(jsonb) is
  'CÁ''S HOA Before User Created hook: exact gmail.com restriction; email signup requires canonical phone; Google onboarding may provide phone later.';

-- A public profile may be read/updated only through existing RLS policies and
-- server-side onboarding code; no password, OTP, or OAuth token is stored here.
