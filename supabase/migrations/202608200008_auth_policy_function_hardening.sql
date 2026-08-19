-- Keep RLS role helpers callable by signed-in users and server service-role code,
-- but not by anonymous clients through the exposed RPC surface.

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff_or_admin() from public, anon;

grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_staff_or_admin() to authenticated, service_role;
