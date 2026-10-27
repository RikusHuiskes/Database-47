-- Run inside a transaction after the migration; rollback keeps fixtures private.
create temporary table existing_event_photos_before as
  select id, slug, source_url, image_url from public.events;

set local role anon;
select public.submit_pending_event('{
  "title":"[TEST SQL] Same title and organizer", "slug":"manual-identity-regression",
  "start_at":"2026-11-21T14:00:00+01:00", "promotion_type":"none",
  "source_url":"https://www.lenourrissat.com",
  "image_url":"https://evvanbexkkdaqdfoginp.supabase.co/storage/v1/object/public/visitor-event-photos/visitor-submissions/adf9d1ec-20cd-49e7-b5d4-d9f40d7958cd.webp"
}'::jsonb);
select public.submit_pending_event('{
  "title":"[TEST SQL] Same title and organizer", "slug":"manual-identity-regression",
  "start_at":"2026-11-22T14:00:00+01:00", "promotion_type":"none",
  "source_url":"https://www.lenourrissat.com",
  "image_url":"https://evvanbexkkdaqdfoginp.supabase.co/storage/v1/object/public/visitor-event-photos/visitor-submissions/adf9d1ec-20cd-49e7-b5d4-d9f40d7958cd.webp"
}'::jsonb);
select public.submit_pending_event('{
  "title":"[TEST SQL] Same title and organizer", "slug":"manual-identity-regression",
  "start_at":"2026-11-23T14:00:00+01:00", "submission_kind":"manual",
  "source_url":"https://www.lenourrissat.com",
  "image_url":"https://evvanbexkkdaqdfoginp.supabase.co/storage/v1/object/public/visitor-event-photos/visitor-submissions/adf9d1ec-20cd-49e7-b5d4-d9f40d7958cd.webp"
}'::jsonb);
reset role;

do $test$
begin
  if (select count(*) from public.events where title='[TEST SQL] Same title and organizer'
      and is_manual_entry and status='pending' and verified=false and image_url is not null) <> 3 then
    raise exception 'Manual submissions or photo URLs were not saved';
  end if;
  if (select count(distinct slug) from public.events where title='[TEST SQL] Same title and organizer') <> 3 then
    raise exception 'Manual slugs collided';
  end if;
  if exists(select 1 from existing_event_photos_before b left join public.events e using(id)
    where e.id is null or (e.slug,e.source_url,e.image_url) is distinct from (b.slug,b.source_url,b.image_url)) then
    raise exception 'Existing event identities or photos changed';
  end if;
  perform public.submit_pending_event('{"title":"[TEST SQL] Imported fixture", "slug":"import-identity-regression", "start_at":"2026-11-21T14:00:00Z", "source_category":"Music", "source_url":"https://example.test/import-identity-regression"}'::jsonb);
  if not exists(select 1 from public.events where slug='import-identity-regression' and not is_manual_entry) then
    raise exception 'Imported slug was changed';
  end if;
  begin
    perform public.submit_pending_event('{"title":"[TEST SQL] Duplicate import", "slug":"import-identity-regression-2", "start_at":"2026-11-21T14:00:00Z", "source_category":"Music", "source_url":"https://example.test/import-identity-regression"}'::jsonb);
    raise exception 'Duplicate imported source was accepted';
  exception when unique_violation then
    null;
  end;
end;
$test$;
select 'PASS: old and new forms, repeated title and source, photo retention, existing rows unchanged, import deduplication' as regression_result;
