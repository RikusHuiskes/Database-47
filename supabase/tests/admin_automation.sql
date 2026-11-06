begin;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare eid uuid:=gen_random_uuid(); aid uuid; cid uuid; result jsonb; n int; imported uuid;
begin
 select id into cid from public.categories where active=true limit 1;
 insert into public.events(id,title,slug,city,source_url,is_manual_entry,is_directory_entry,status,verified,created_at)
 values(eid,'[TEST] Admin alerts',eid::text,'Duras','https://www.cotededuras.com/',true,true,'pending',false,now()-interval '1 day');
 select count(*) into n from public.listing_mail_outbox where event_id=eid and payload->>'kind'='submission';
 if n<>1 then raise exception 'Submission mail count %',n;end if;
 update public.events set status='approved',verified=true where id=eid;
 perform public.update_managed_event(eid,jsonb_build_object('title','[TEST] Changed','city','Duras','source_url','https://www.cotededuras.com/'),cid);
 if not exists(select 1 from public.events where id=eid and status='pending' and not verified) then raise exception 'Owner change bypassed moderation';end if;
 select count(*) into n from public.listing_mail_outbox where event_id=eid and payload->>'kind'='change';
 if n<>1 then raise exception 'Change/category mails not deduplicated: %',n;end if;
 insert into public.advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents,is_test_mode)
 values(eid,'highlight','{}',current_date,current_date+30,1,1500,true) returning id into aid;
 update public.advertising_requests set payment_status='paid' where id=aid;
 update public.advertising_requests set payment_status='paid' where id=aid;
 select count(*) into n from public.listing_mail_outbox where event_id=eid and payload->>'kind'='payment';
 if n<>1 then raise exception 'Duplicate payment mail: %',n;end if;
 if exists(select 1 from public.listing_mail_outbox where event_id=eid and (recipient<>'info@cotededuras.com' or payload ? 'token' or payload ? 'details')) then raise exception 'Unsafe admin payload';end if;
 result:=public.import_pending_source_events(jsonb_build_array(jsonb_build_object('title','[TEST] Trusted import','slug',gen_random_uuid()::text,'start_at','2099-12-01T12:00:00Z','city','Duras','source_url','https://openagenda.com/cdd-test/events/'||eid::text,'category_id',cid)));
 if result->>'inserted'<>'1' then raise exception 'Trusted source rejected: %',result;end if;
 select id into imported from public.events where source_url='https://openagenda.com/cdd-test/events/'||eid::text;
 if not exists(select 1 from public.events where id=imported and status='approved' and verified and not is_manual_entry) then raise exception 'Trusted import not approved';end if;
 if exists(select 1 from public.listing_mail_outbox where event_id=imported) then raise exception 'Import generated manual mail';end if;
 begin
  perform public.import_pending_source_events(jsonb_build_array(jsonb_build_object('title','[TEST] Bad source','start_at','2099-12-01T12:00:00Z','source_url','https://openagendaXcom/evil/events/test')));
  raise exception 'UNTRUSTED_ACCEPTED';
 exception when others then if sqlerrm='UNTRUSTED_ACCEPTED' then raise;end if;end;
 if has_function_privilege('anon','public.configure_cdd_automation(text)','execute') or has_function_privilege('authenticated','public.queue_admin_activity(text,uuid,text,text,jsonb)','execute') then raise exception 'Public privileged access';end if;
 if ('2027-01-15 07:00Z'::timestamptz at time zone 'Europe/Paris')::time<>'08:00' or ('2027-07-15 06:00Z'::timestamptz at time zone 'Europe/Paris')::time<>'08:00' then raise exception 'DST check failed';end if;
 if exists(select 1 from public.automation_settings where enabled) then raise exception 'Test scheduler must be disabled';end if;
 perform public.dispatch_cdd_automation();
end $$;
rollback;
select 'PASS: manual moderation, admin alerts, category dedupe, payment dedupe, trusted imports, source boundaries, permissions and DST. All test data rolled back.' as result;
