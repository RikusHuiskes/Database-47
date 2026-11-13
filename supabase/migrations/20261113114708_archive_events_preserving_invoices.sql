-- Removal from the active catalogue must not cascade into issued invoices.
alter table public.events add column if not exists archived_at timestamptz;

create or replace function public.keep_archived_events_hidden()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.archived_at is not null then
    new.status := 'rejected';
    new.verified := false;
    new.promotion_status := 'ended';
    new.reserved_homepage := false;
    new.reserved_category_id := null;
    new.advertising_placements := '[]'::jsonb;
  end if;
  return new;
end;
$$;
create trigger keep_archived_events_hidden before insert or update on public.events
for each row execute function public.keep_archived_events_hidden();

create or replace function public.archive_event(p_event_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role'
     and not coalesce(public.is_admin(),false) then
    raise exception 'Beheerderstoegang vereist.';
  end if;
  update public.events set archived_at=coalesce(archived_at,now()),updated_at=now()
  where id=p_event_id returning id into v_id;
  if v_id is null then raise exception 'Vermelding niet gevonden.'; end if;
  return v_id;
end;
$$;
revoke all on function public.archive_event(uuid) from public,anon;
grant execute on function public.archive_event(uuid) to authenticated,service_role;
revoke all on function public.keep_archived_events_hidden() from public,anon,authenticated;

-- Retain already archived records and any records with financial history.
-- One protected invoice must not abort cleanup of all other expired events.
create or replace function public.delete_expired_events()
returns integer language plpgsql security definer set search_path='' as $$
declare deleted_count integer;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Beheerderstoegang vereist.'; end if;
  delete from public.events e where e.archived_at is null
    and (coalesce(e.end_at,e.start_at) at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date
    and not exists(select 1 from public.advertising_requests r join public.advertising_invoices i on i.request_id=r.id where r.event_id=e.id);
  get diagnostics deleted_count=row_count;
  return deleted_count;
end;
$$;

create or replace function public.delete_expired_events_cron()
returns integer language plpgsql security definer set search_path='' as $$
declare deleted_count integer;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Server-to-server access required.'; end if;
  delete from public.events e where e.archived_at is null
    and (coalesce(e.end_at,e.start_at) at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date
    and not exists(select 1 from public.advertising_requests r join public.advertising_invoices i on i.request_id=r.id where r.event_id=e.id);
  get diagnostics deleted_count=row_count;
  return deleted_count;
end;
$$;
