-- Queued together with the data change: no customer data or access tokens in admin mail.
begin;
alter table public.listing_mail_outbox alter column request_id drop not null;
alter table public.listing_mail_outbox add column if not exists event_id uuid references public.events(id) on delete cascade;
alter table public.listing_mail_outbox add constraint listing_mail_admin_activity_check
 check (request_id is not null or (payload->>'audience'='admin' and template='received' and recipient='info@cotededuras.com'));
create index if not exists listing_mail_event_idx on public.listing_mail_outbox(event_id) where event_id is not null;

create or replace function public.queue_admin_activity(p_kind text,p_event_id uuid,p_reference text,p_dedupe text,p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare event_title text; directory boolean;
begin
 select title,municipal_key is not null into event_title,directory from public.events where id=p_event_id;
 insert into public.listing_mail_outbox(event_id,template,recipient,payload,dedupe_key)
 values(p_event_id,'received','info@cotededuras.com',p_extra||jsonb_build_object('audience','admin','kind',p_kind,'title',coalesce(event_title,'Dagelijkse update'),'directory',coalesce(directory,false),'reference',p_reference),p_dedupe)
 on conflict(dedupe_key) do nothing;
end $$;
revoke all on function public.queue_admin_activity(text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.queue_admin_activity(text,uuid,text,text,jsonb) to service_role;

create or replace function public.notify_manual_event_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare changed boolean; kind text;
begin
 if current_setting('cdd.trusted_import',true)='on' then return new;end if;
 if tg_op='INSERT' then
  if not coalesce(new.is_manual_entry,false) then return new;end if;
  kind:='submission';
 else
  changed:= (to_jsonb(new)-array['updated_at','latitude','longitude','status','verified','promotion_type','promotion_status','promotion_start_at','promotion_end_at','advertising_placements','reserved_homepage'])
    is distinct from (to_jsonb(old)-array['updated_at','latitude','longitude','status','verified','promotion_type','promotion_status','promotion_start_at','promotion_end_at','advertising_placements','reserved_homepage']);
  if not changed or new.created_at=transaction_timestamp() then return new;end if;
  kind:='change';
 end if;
 perform public.queue_admin_activity(kind,new.id,new.id::text,'event:'||new.id::text||':'||kind||':'||txid_current()::text);
 return new;
end $$;
revoke all on function public.notify_manual_event_activity() from public,anon,authenticated;
create trigger notify_manual_event_activity after insert or update on public.events for each row execute function public.notify_manual_event_activity();

create or replace function public.notify_manual_category_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare eid uuid:=coalesce(new.event_id,old.event_id);
begin
 if current_setting('cdd.trusted_import',true)='on' then return null;end if;
 if exists(select 1 from public.events where id=eid and created_at<>transaction_timestamp()) then
  perform public.queue_admin_activity('change',eid,eid::text,'event:'||eid::text||':change:'||txid_current()::text);
 end if;
 return null;
end $$;
revoke all on function public.notify_manual_category_activity() from public,anon,authenticated;
create trigger notify_manual_category_activity after insert or update or delete on public.event_categories for each row execute function public.notify_manual_category_activity();

create or replace function public.notify_advertising_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 if tg_op='INSERT' then kind:='advertising';
 elsif new.payment_status is distinct from old.payment_status and new.payment_status in ('paid','failed','canceled','expired','refunded') then kind:='payment';
 else return new;end if;
 perform public.queue_admin_activity(kind,new.event_id,new.id::text,'advertising:'||new.id::text||':'||kind||':'||new.payment_status,
  jsonb_build_object('status',new.payment_status,'amountCents',new.amount_cents,'test',new.is_test_mode));
 return new;
end $$;
revoke all on function public.notify_advertising_activity() from public,anon,authenticated;
create trigger notify_advertising_activity after insert or update on public.advertising_requests for each row execute function public.notify_advertising_activity();

-- Owner edits require renewed review. Admin edits and automatic imports retain their own workflow.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.update_managed_event(uuid,jsonb,uuid)'::regprocedure) into definition;
 if position('update public.events set' in definition)=0 then raise exception 'Unexpected owner update function';end if;
 definition:=replace(definition,'update public.events set','update public.events set status=''pending'',verified=false,');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
