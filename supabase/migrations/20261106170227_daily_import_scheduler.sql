begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table public.automation_settings (
 id boolean primary key default true check(id),enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.automation_settings(id) values(true);
create table public.daily_import_runs (
 run_on date not null,path text not null,state text not null default 'pending' check(state in ('pending','running','done','failed')),
 attempts int not null default 0,request_id bigint,started_at timestamptz,finished_at timestamptz,result jsonb,
 primary key(run_on,path)
);
alter table public.automation_settings enable row level security;
alter table public.daily_import_runs enable row level security;
revoke all on public.automation_settings,public.daily_import_runs from public,anon,authenticated;
grant all on public.automation_settings,public.daily_import_runs to service_role;

create or replace function public.dispatch_cdd_automation()
returns void language plpgsql security definer set search_path='' as $$
declare local_now timestamp:=now() at time zone 'Europe/Paris'; secret text; job record; response record; body jsonb; request bigint; failed boolean; report text;
begin
 if not exists(select 1 from public.automation_settings where enabled) then return;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('cdd-daily-automation',0)) then return;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='cdd_cron_secret';
 if secret is null then return;end if;
 -- DST-safe. A short catch-up window also tolerates a database restart at 08:00.
 if local_now::time between time '08:00' and time '08:15' then
  insert into public.daily_import_runs(run_on,path)
  select local_now::date,path from unnest(array['import-tourisme-duras','import-eymet','import-sirtaqui','import-openagenda','import-regional-agendas','import-directory','cleanup-expired-events']) path
  on conflict do nothing;
 end if;
 for job in select * from public.daily_import_runs where state='running' loop
  select * into response from net._http_response where id=job.request_id;
  if found then
   begin body:=response.content::jsonb;exception when others then body:='{}'::jsonb;end;
   failed:=coalesce(response.status_code,0) not between 200 and 299 or coalesce(response.timed_out,false) or body ? 'error'
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(body->'sources')='array' then body->'sources' else '[]'::jsonb end) source where nullif(source->>'error','') is not null);
   update public.daily_import_runs set state=case when failed and attempts<2 then 'pending' when failed then 'failed' else 'done' end,
    finished_at=now(),result=jsonb_build_object('httpStatus',response.status_code,'checked',coalesce(body->'checked',body->'fetched'),'inserted',body->'inserted','skipped',body->'skipped','sources',body->'sources','error',case when failed then 'Bron niet bereikbaar of import niet afgerond.' else null end)
   where run_on=job.run_on and path=job.path;
  elsif job.started_at<now()-interval '8 minutes' then
   update public.daily_import_runs set state=case when attempts<2 then 'pending' else 'failed' end,finished_at=now(),result=jsonb_build_object('error','Geen antwoord binnen acht minuten.') where run_on=job.run_on and path=job.path;
  end if;
 end loop;
 for job in select * from public.daily_import_runs where state='pending' and run_on=local_now::date and attempts<2 loop
  select net.http_get(url:='https://www.cotededuras.com/api/cron/'||job.path,headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=310000) into request;
  update public.daily_import_runs set state='running',attempts=attempts+1,request_id=request,started_at=now(),finished_at=null where run_on=job.run_on and path=job.path;
 end loop;
 for job in select run_on,bool_or(state='failed') failed from public.daily_import_runs r where not exists(select 1 from public.listing_mail_outbox m where m.dedupe_key='daily-import:'||r.run_on::text) group by run_on having bool_and(state in ('done','failed')) loop
  select string_agg(path||': '||case when state='done' then 'afgerond, nieuw: '||coalesce(result->>'inserted','0') else 'niet afgerond — controle nodig' end,E'\n' order by path) into report from public.daily_import_runs where run_on=job.run_on;
  perform public.queue_admin_activity(case when job.failed then 'import_failure' else 'daily_import' end,null,job.run_on::text,'daily-import:'||job.run_on::text,jsonb_build_object('summary',report));
 end loop;
 -- Only call the mail worker when there is actual work; existing leases prevent duplicate claims.
 if exists(select 1 from public.listing_mail_outbox where attempts<5 and ((state='pending' and next_attempt_at<=now()) or (state='sending' and claimed_at<now()-interval '10 minutes')))
 or exists(select 1 from public.advertising_invoice_mail_outbox where attempts<5 and ((state='pending' and next_attempt_at<=now()) or (state='sending' and claimed_at<now()-interval '10 minutes'))) then
  perform net.http_get(url:='https://www.cotededuras.com/api/cron/listing-mail',headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=310000);
 end if;
 -- Keep scheduler history intact; retention can be configured separately.
end $$;
revoke all on function public.dispatch_cdd_automation() from public,anon,authenticated;
grant execute on function public.dispatch_cdd_automation() to service_role;

create or replace function public.configure_cdd_automation(p_secret text)
returns void language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
 if length(p_secret)<20 then raise exception 'Ongeldige serversleutel';end if;
 select id into existing from vault.secrets where name='cdd_cron_secret';
 if existing is null then perform vault.create_secret(p_secret,'cdd_cron_secret','Côte de Duras scheduler only');
 else perform vault.update_secret(existing,p_secret);end if;
 update public.automation_settings set enabled=true,updated_at=now();
 perform cron.schedule('cdd-daily-automation','* * * * *','select public.dispatch_cdd_automation()');
end $$;
revoke all on function public.configure_cdd_automation(text) from public,anon,authenticated;
grant execute on function public.configure_cdd_automation(text) to service_role;
notify pgrst,'reload schema';
commit;
