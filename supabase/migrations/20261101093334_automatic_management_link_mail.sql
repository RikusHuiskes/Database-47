begin;
alter table public.listing_mail_outbox add column encrypted_secret text;
alter table public.listing_mail_outbox drop constraint listing_mail_outbox_template_check;
alter table public.listing_mail_outbox add constraint listing_mail_outbox_template_check check(template in ('received','decision','management'));
alter table public.listing_mail_outbox add constraint listing_mail_secret_required check(template<>'management' or encrypted_secret is not null or state in ('accepted','failed'));
create or replace function public.review_listing_request(p_id uuid,p_action text,p_note text,p_contact text,p_token_hash text,p_reviewer uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
 r public.listing_requests%rowtype;
 previous_request public.listing_requests%rowtype;
 access_count integer;
begin
 if p_action in ('approved','reissued') and current_setting('app.management_mail',true) is distinct from 'queued' then raise exception 'Open de actuele beheermodule om goed te keuren met automatische beheerlinkmail.';end if;
 select * into r from public.listing_requests where id=p_id for update;
 if not found then raise exception 'Aanvraag niet gevonden.';end if;
 perform 1 from public.events where id=r.event_id for update;
 if length(btrim(coalesce(p_note,'')))<15 or length(p_note)>4000 then raise exception 'Leg de controle of beslissing vast (minimaal 15 tekens).';end if;
 if p_action in ('approved','reissued') then
  if r.kind<>'claim' or r.status<>'pending' then raise exception 'Alleen een open beheeraanvraag kan worden goedgekeurd of hersteld.';end if;
  if length(btrim(coalesce(p_contact,'')))<5 or length(p_contact)>1000 then raise exception 'Vermeld het onafhankelijk gecontroleerde contactadres of telefoonnummer en de officiële bron.';end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Ongeldige beheerlink.';end if;
  if p_action='approved' then
   if exists(select 1 from public.event_owner_access where event_id=r.event_id) then raise exception 'Deze vermelding heeft al beheerrechten. Gebruik gecontroleerd herstel.';end if;
   insert into public.event_owner_access(event_id,token_hash,request_id)values(r.event_id,p_token_hash,r.id);
  else
   select count(*) into access_count from public.event_owner_access where event_id=r.event_id;
   if access_count<>1 then raise exception 'Herstel kan niet veilig worden uitgevoerd: laat het bestaande beheer eerst handmatig controleren.';end if;
   for previous_request in
    select * from public.listing_requests where event_id=r.event_id and kind='claim' and status='approved' for update
   loop
    insert into public.listing_review_history(request_id,action,note,contact,reviewer_id)
    values(previous_request.id,'revoked','Beheerlink vervangen na onafhankelijke verificatie: '||btrim(p_note),nullif(p_contact,''),p_reviewer);
    update public.listing_requests
    set status='revoked',verification_note='Beheerlink vervangen na onafhankelijke verificatie: '||btrim(p_note),verified_contact=nullif(p_contact,''),reviewed_at=now()
    where id=previous_request.id;
   end loop;
   update public.event_owner_access set token_hash=p_token_hash,request_id=r.id where event_id=r.event_id;
  end if;
 elsif p_action='revoked' then
  if r.status<>'approved' or r.kind<>'claim' then raise exception 'Alleen verleende beheerrechten kunnen worden ingetrokken.';end if;
  delete from public.event_owner_access where request_id=r.id;
 elsif p_action not in ('rejected','resolved') or r.status<>'pending' or (p_action='resolved' and r.kind<>'correction') then
  raise exception 'Ongeldige beslissing.';
 end if;
 insert into public.listing_review_history(request_id,action,note,contact,reviewer_id)
 values(p_id,case when p_action='reissued' then 'approved' else p_action end,p_note,nullif(p_contact,''),p_reviewer);
 update public.listing_requests
 set status=case when p_action='reissued' then 'approved' else p_action end,verification_note=p_note,verified_contact=nullif(p_contact,''),reviewed_at=now()
 where id=p_id;
 return r.event_id;
end $$;
notify pgrst,'reload schema';

create or replace function public.enqueue_listing_mail() returns trigger
language plpgsql security invoker set search_path='' as $$
declare title text; template_name text; unique_key text;
begin
 if TG_OP='UPDATE' and new.status is not distinct from old.status then return new;end if;
 if TG_OP='UPDATE' and new.status='approved' and current_setting('app.management_mail',true)='queued' then return new;end if;
 if TG_OP='INSERT' then template_name:='received';unique_key:=new.id::text||':received';
 else template_name:='decision';unique_key:=new.id::text||':'||new.status;end if;
 select e.title into title from public.events e where e.id=new.event_id;
 insert into public.listing_mail_outbox(request_id,template,recipient,payload,dedupe_key)
 values(new.id,template_name,new.email,jsonb_build_object('kind',new.kind,'status',new.status,'title',title,'reference',new.id),unique_key)
 on conflict(dedupe_key) do nothing;
 return new;
end $$;

create or replace function public.claim_listing_mail(p_limit integer default 3) returns setof public.listing_mail_outbox
language plpgsql security invoker set search_path='' as $$
begin
 update public.listing_mail_outbox set state='failed',lease_token=null,last_error='Verzending niet afgerond na vijf pogingen.' where state='sending' and attempts>=5 and claimed_at<now()-interval '10 minutes';
 return query update public.listing_mail_outbox m set state='sending',attempts=m.attempts+1,lease_token=gen_random_uuid(),claimed_at=now()
 where m.id in (select id from public.listing_mail_outbox
 where template<>'management' and attempts<5 and ((state='pending' and next_attempt_at<=now()) or (state='sending' and claimed_at<now()-interval '10 minutes'))
 order by created_at limit least(10,greatest(1,p_limit)) for update skip locked)
 returning m.*;
end;
$$;

create or replace function public.claim_listing_mail_v2(p_limit integer default 3) returns setof public.listing_mail_outbox
language plpgsql security invoker set search_path='' as $$
begin
 update public.listing_mail_outbox set state='failed',lease_token=null,last_error='Verzending niet afgerond na vijf pogingen.' where state='sending' and attempts>=5 and claimed_at<now()-interval '10 minutes';
 return query update public.listing_mail_outbox m set state='sending',attempts=m.attempts+1,lease_token=gen_random_uuid(),claimed_at=now()
 where m.id in (select id from public.listing_mail_outbox
 where attempts<5 and ((state='pending' and next_attempt_at<=now()) or (state='sending' and claimed_at<now()-interval '10 minutes'))
 order by (template='management') desc,created_at limit least(10,greatest(1,p_limit)) for update skip locked)
 returning m.*;
end;
$$;

revoke all on function public.claim_listing_mail_v2(integer) from public,anon,authenticated;
grant execute on function public.claim_listing_mail_v2(integer) to service_role;

create function public.review_listing_request_with_mail(p_id uuid,p_action text,p_note text,p_contact text,p_token_hash text,p_reviewer uuid,p_email text,p_encrypted_secret text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare eid uuid;mid uuid;listing_title text;old_setting text;
begin
 if p_action not in ('approved','reissued') then raise exception 'Ongeldige goedkeuring.';end if;
 if length(p_email)>254 or p_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+[.][^[:space:]@<>]+$' then raise exception 'Vul het gecontroleerde e-mailadres voor de beheerlink in.';end if;
 if p_encrypted_secret is null or length(p_encrypted_secret)>16000 or p_encrypted_secret !~ '^v1[.]' then raise exception 'De beveiligde beheerlinkmail ontbreekt.';end if;
 old_setting:=current_setting('app.management_mail',true);
 perform set_config('app.management_mail','queued',true);
 eid:=public.review_listing_request(p_id,p_action,p_note,p_contact,p_token_hash,p_reviewer);
 perform set_config('app.management_mail',coalesce(old_setting,''),true);
 select e.title into listing_title from public.events e where e.id=eid;
 insert into public.listing_mail_outbox(request_id,template,recipient,payload,dedupe_key,encrypted_secret)
 values(p_id,'management',lower(btrim(p_email)),jsonb_build_object('title',listing_title,'reference',p_id,'eventId',eid),p_id::text||':management:'||p_token_hash,p_encrypted_secret) returning id into mid;
 return jsonb_build_object('eventId',eid,'mailId',mid);
end $$;
revoke all on function public.review_listing_request_with_mail(uuid,text,text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_listing_request_with_mail(uuid,text,text,text,text,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
