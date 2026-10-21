-- Apply to Database 47 Test only. This removes every event (imported or manual,
-- pending or approved) whose effective final date is before today in France.
-- For multi-day events, end_at is authoritative; events without end_at use start_at.

create or replace function public.delete_expired_events()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  deleted_count integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Beheerderstoegang vereist.';
  end if;

  delete from public.events
  where (
    (coalesce(end_at, start_at) at time zone 'Europe/Paris')::date
  ) < (
    (now() at time zone 'Europe/Paris')::date
  );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.delete_expired_events() from public, anon;
grant execute on function public.delete_expired_events() to authenticated;
