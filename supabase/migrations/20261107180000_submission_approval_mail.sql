begin;

-- Only new, server-validated submissions get a private delivery record. There
-- is deliberately no backfill from public contact addresses or historic ads.
create table public.listing_submission_contacts (
 event_id uuid primary key references public.events(id) on delete cascade,
 recipient text not null check (length(recipient)<=254 and recipient ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+[.][^[:space:]@<>]+$'),
 locale text not null check (locale in ('fr','en','nl')),
 token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
 encrypted_secret text,
 created_at timestamptz not null default now(),
 queued_at timestamptz,
 check (queued_at is not null or encrypted_secret is not null)
);
alter table public.listing_submission_contacts enable row level security;
revoke all on public.listing_submission_contacts from public,anon,authenticated;
grant all on public.listing_submission_contacts to service_role;

alter table public.listing_mail_outbox drop constraint listing_mail_admin_activity_check;
alter table public.listing_mail_outbox add constraint listing_mail_admin_activity_check check (
 request_id is not null
 or (payload->>'audience'='admin' and template='received' and recipient='info@cotededuras.com')
 or (event_id is not null and template='management' and payload->>'purpose'='submission_approved' and payload->>'eventId'=event_id::text)
);

create function public.register_submission_contact(p_id uuid,p_token_hash text,p_contact jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_contact->>'recipient' is null or p_contact->>'locale' is null
 or p_contact->>'encrypted_secret' is null or length(p_contact->>'encrypted_secret')>16000
 or p_contact->>'encrypted_secret' !~ '^v1[.]' then raise exception 'De beveiligde beheerlinkmail ontbreekt.';end if;
 if not exists(select 1 from public.events e join public.event_owner_access a on a.event_id=e.id
  where e.id=p_id and e.is_manual_entry and e.status='pending' and not e.verified and a.token_hash=p_token_hash)
 then raise exception 'Ongeldige nieuwe aanmelding.';end if;
 insert into public.listing_submission_contacts(event_id,recipient,locale,token_hash,encrypted_secret)
 values(p_id,lower(trim(p_contact->>'recipient')),p_contact->>'locale',p_token_hash,p_contact->>'encrypted_secret');
end $$;
revoke all on function public.register_submission_contact(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.register_submission_contact(uuid,text,jsonb) to service_role;

create function public.submit_managed_event_with_contact(p_event jsonb,p_category_id uuid,p_token_hash text,p_ad jsonb,p_contact jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare eid uuid;
begin
 if p_ad is not null and p_ad->'details'->'placements' is not null then
  eid:=public.submit_managed_event_selection(p_event,p_category_id,p_token_hash,p_ad);
 else eid:=public.submit_managed_event(p_event,p_category_id,p_token_hash,p_ad);end if;
 perform public.register_submission_contact(eid,p_token_hash,p_contact);
 return eid;
end $$;
revoke all on function public.submit_managed_event_with_contact(jsonb,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_managed_event_with_contact(jsonb,uuid,text,jsonb,jsonb) to service_role;

create function public.submit_municipal_listing_with_contact(p_event jsonb,p_token_hash text,p_contact jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare eid uuid:=(p_event->>'id')::uuid;
begin
 if eid is null or p_event->>'municipal_key' is distinct from 'submitted:'||eid::text
 or p_event->>'municipal_code' is null or p_event->>'municipal_type' is null
 then raise exception 'Ongeldige bedrijfsaanmelding.';end if;
 -- Explicit columns preserve database defaults and exclude client authority.
 insert into public.events(id,slug,title,address,postcode,city,municipal_key,municipal_code,municipal_type,
  municipal_email,municipal_hours,contact_phone,website_url,source_url,image_url,short_description,description,
  status,verified,is_directory_entry,is_manual_entry,start_at,end_at,promotion_type,promotion_status)
 values(eid,'municipal-'||eid::text,p_event->>'title',p_event->>'address',p_event->>'postcode',p_event->>'city',
  p_event->>'municipal_key',p_event->>'municipal_code',p_event->>'municipal_type',p_event->>'municipal_email',
  p_event->>'municipal_hours',p_event->>'contact_phone',p_event->>'website_url',p_event->>'source_url',
  p_event->>'image_url',p_event->>'short_description',p_event->>'description','pending',false,true,true,null,null,'none','none');
 insert into public.event_owner_access(event_id,token_hash) values(eid,p_token_hash);
 perform public.register_submission_contact(eid,p_token_hash,p_contact);
 return eid;
end $$;
revoke all on function public.submit_municipal_listing_with_contact(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_municipal_listing_with_contact(jsonb,text,jsonb) to service_role;

-- Definer is necessary for existing authenticated admin review clients; it
-- exposes no RPC and only moves the previously stored server-only secret.
create function public.queue_submission_approval_mail() returns trigger
language plpgsql security definer set search_path='' as $$
declare contact public.listing_submission_contacts;
begin
 if new.status is distinct from 'approved' or new.verified is distinct from true
 or (old.status='approved' and old.verified=true) then return new;end if;
 select * into contact from public.listing_submission_contacts where event_id=new.id for update;
 if not found or contact.queued_at is not null then return new;end if;
 -- A subsequently recovered/revoked owner key must never be mailed again.
 if not exists(select 1 from public.event_owner_access where event_id=new.id and token_hash=contact.token_hash) then return new;end if;
 insert into public.listing_mail_outbox(event_id,template,recipient,payload,dedupe_key,encrypted_secret)
 values(new.id,'management',contact.recipient,jsonb_build_object('purpose','submission_approved','eventId',new.id,
  'title',new.title,'locale',contact.locale),'submission-approved:'||new.id::text,contact.encrypted_secret)
 on conflict(dedupe_key) do nothing;
 update public.listing_submission_contacts set queued_at=now(),encrypted_secret=null where event_id=new.id;
 return new;
end $$;
revoke all on function public.queue_submission_approval_mail() from public,anon,authenticated;
create trigger queue_submission_approval_mail after update of status,verified on public.events
 for each row execute function public.queue_submission_approval_mail();

-- Keep the existing worker API. Approval messages wait if publication is
-- withdrawn before delivery; imported entries have no private contact record.
create or replace function public.claim_listing_mail_v2(p_limit integer default 3) returns setof public.listing_mail_outbox
language plpgsql security invoker set search_path='' as $$
begin
 update public.listing_mail_outbox set state='failed',lease_token=null,last_error='Verzending niet afgerond na vijf pogingen.' where state='sending' and attempts>=5 and claimed_at<now()-interval '10 minutes';
 return query update public.listing_mail_outbox m set state='sending',attempts=m.attempts+1,lease_token=gen_random_uuid(),claimed_at=now()
 where m.id in (select q.id from public.listing_mail_outbox q
 where q.attempts<5 and ((q.state='pending' and q.next_attempt_at<=now()) or (q.state='sending' and q.claimed_at<now()-interval '10 minutes'))
 and (q.payload->>'purpose' is distinct from 'submission_approved' or exists(select 1 from public.events e where e.id=q.event_id and e.status='approved' and e.verified))
 order by (q.template='management') desc,q.created_at limit least(10,greatest(1,p_limit)) for update of q skip locked)
 returning m.*;
end $$;
-- Start delivery for the just-approved listing, independent of queue backlog.
create function public.claim_submission_approval_mail(p_event_id uuid) returns setof public.listing_mail_outbox
language plpgsql security invoker set search_path='' as $$
begin
 return query update public.listing_mail_outbox m set state='sending',attempts=m.attempts+1,lease_token=gen_random_uuid(),claimed_at=now()
 where m.id in (select q.id from public.listing_mail_outbox q
 where q.event_id=p_event_id and q.payload->>'purpose'='submission_approved' and q.template='management'
 and q.attempts<5 and ((q.state='pending' and q.next_attempt_at<=now()) or (q.state='sending' and q.claimed_at<now()-interval '10 minutes'))
 and exists(select 1 from public.events e where e.id=q.event_id and e.status='approved' and e.verified)
 for update of q skip locked)
 returning m.*;
end $$;
revoke all on function public.claim_submission_approval_mail(uuid) from public,anon,authenticated;
grant execute on function public.claim_submission_approval_mail(uuid) to service_role;
notify pgrst,'reload schema';
commit;
