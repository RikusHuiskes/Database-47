-- Deploy to the selected Supabase project (Test or Production).
-- Restores the RPC expected by the admin page and lets admins rename category
-- labels without changing the stable slug used by imports.

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
  where (coalesce(end_at, start_at) at time zone 'Europe/Paris')::date
    < (now() at time zone 'Europe/Paris')::date;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.delete_expired_events() from public, anon;
grant execute on function public.delete_expired_events() to authenticated;

create or replace function public.update_category_name(
  p_category_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Beheerderstoegang vereist.';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 80 then
    raise exception 'De categorienaam moet 1 tot 80 tekens bevatten.';
  end if;

  update public.categories
  set name = btrim(p_name)
  where id = p_category_id;

  if not found then
    raise exception 'Categorie niet gevonden.';
  end if;
end;
$function$;

revoke all on function public.update_category_name(uuid, text) from public, anon;
grant execute on function public.update_category_name(uuid, text) to authenticated;

notify pgrst, 'reload schema';
