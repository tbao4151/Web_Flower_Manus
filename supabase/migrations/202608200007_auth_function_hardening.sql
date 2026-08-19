-- Harden functions introduced by the CÁ'S HOA auth rebuild.

create or replace function public.is_gmail_email(input text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(input, ''))) ~ '^[^@[:space:]]+@gmail[.]com$';
$$;

create or replace function public.normalize_gmail(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(input, '')));
$$;

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') ~ '^\\+84[0-9]{9}$'
      then '0' || substring(regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') from 4)
    when regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') ~ '^84[0-9]{9}$'
      then '0' || substring(regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g') from 3)
    else regexp_replace(coalesce(input, ''), '[^0-9+]', '', 'g')
  end;
$$;

revoke execute on function public.is_gmail_email(text) from public, anon, authenticated;
revoke execute on function public.normalize_gmail(text) from public, anon, authenticated;
revoke execute on function public.normalize_phone(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.hook_restrict_cas_hoa_signup(jsonb) from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.hook_restrict_cas_hoa_signup(jsonb) to supabase_auth_admin;
