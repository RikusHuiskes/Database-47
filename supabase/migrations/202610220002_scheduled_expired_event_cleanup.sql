-- Apply after the existing delete_expired_events migration.
-- This server-only function lets Vercel's protected daily job remove expired
-- events regardless of whether they are pending, approved, or manually entered.

create or replace function public.delete_expired_events_cron()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  deleted_count integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Server-to-server access required.';
  end if;

  delete from public.events
  where ((coalesce(end_at, start_at) at time zone 'Europe/Paris')::date)
    < ((now() at time zone 'Europe/Paris')::date);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.delete_expired_events_cron() from public, anon, authenticated;
grant execute on function public.delete_expired_events_cron() to service_role;
