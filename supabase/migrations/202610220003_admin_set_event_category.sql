-- Keep category corrections atomic and restricted to authenticated admins.

create or replace function public.set_event_category(
  p_event_id uuid,
  p_category_id uuid
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

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Evenement niet gevonden.';
  end if;

  if p_category_id is not null
    and not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Categorie niet gevonden.';
  end if;

  delete from public.event_categories where event_id = p_event_id;

  if p_category_id is not null then
    insert into public.event_categories (event_id, category_id)
    values (p_event_id, p_category_id);
  end if;
end;
$function$;

revoke all on function public.set_event_category(uuid, uuid) from public, anon;
grant execute on function public.set_event_category(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
