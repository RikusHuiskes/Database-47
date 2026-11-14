-- Keep the deployed admin's billing relation an array, including zero/one cycle.
-- Preserve request_id uniqueness and all payment data; only service-role may call.
create function public.advertising_billing_cycles(request public.advertising_requests)
returns setof public.advertising_billing_cycles
language sql stable security invoker rows 1000
set search_path = ''
as $$
  select cycle.*
  from public.advertising_billing_cycles as cycle
  where cycle.request_id = request.id
$$;
revoke all on function public.advertising_billing_cycles(public.advertising_requests) from public, anon, authenticated;
grant execute on function public.advertising_billing_cycles(public.advertising_requests) to service_role;
notify pgrst, 'reload schema';
