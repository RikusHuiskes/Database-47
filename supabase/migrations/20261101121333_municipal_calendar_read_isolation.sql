begin;
-- Calendar readers receive only calendar records. The municipal API publishes
-- approved business fields through the server; its billing and ownership data
-- are never exposed. Existing authenticated administrator policies are retained.
alter table public.events enable row level security;
drop policy if exists public_read_approved_events on public.events;
create policy public_read_approved_events on public.events for select to public using(status='approved' and verified=true and municipal_key is null);
notify pgrst,'reload schema';
commit;
