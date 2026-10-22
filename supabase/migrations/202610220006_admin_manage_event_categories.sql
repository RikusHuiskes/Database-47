-- Allow category changes through the table API when PostgREST's function cache
-- is stale. Only authenticated administrators can change event/category links.

drop policy if exists admin_manage_event_categories on public.event_categories;

create policy admin_manage_event_categories
on public.event_categories
for all
to authenticated
using (coalesce(public.is_admin(), false))
with check (coalesce(public.is_admin(), false));

notify pgrst, 'reload schema';
