-- The service API reads only this public projection. Full jobs stay visible
-- with a 3/3 counter, while manually withdrawn jobs leave the feed.
create view public.travaux_public_feed with (security_invoker = true) as
select j.id, j.title, j.description, j.category, j.commune, j.created_at,
       totals.response_count
from public.travaux_jobs j
cross join lateral (
  select count(*)::integer as response_count
  from public.travaux_responses r
  where r.job_id = j.id
) totals
where j.status = 'open' or (j.status = 'closed' and totals.response_count = 3);

revoke all on public.travaux_public_feed from public, anon, authenticated;
grant select on public.travaux_public_feed to service_role;
