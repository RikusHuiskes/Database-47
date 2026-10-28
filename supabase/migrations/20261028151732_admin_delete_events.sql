begin;
create policy "Admins can delete events" on public.events for delete to authenticated using ((select public.is_admin()));
commit;
