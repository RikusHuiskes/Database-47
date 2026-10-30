begin;
create table public.listing_mail_outbox (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.listing_requests(id) on delete cascade,
 template text not null check(template in ('received','decision')),recipient text not null,payload jsonb not null,
 dedupe_key text not null unique,state text not null default 'pending' check(state in ('pending','sending','accepted','failed')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_token uuid,
 claimed_at timestamptz,accepted_at timestamptz,last_error text,created_at timestamptz not null default now()
);
create index listing_mail_request_idx on public.listing_mail_outbox(request_id);
create index listing_mail_pending_idx on public.listing_mail_outbox(next_attempt_at) where state in ('pending','sending');
alter table public.listing_mail_outbox enable row level security;
revoke all on public.listing_mail_outbox from public,anon,authenticated;
grant all on public.listing_mail_outbox to service_role;

-- The server-only request functions run as service_role. The notification is
-- inserted in the same transaction as the request or review decision.
create function public.enqueue_listing_mail() returns trigger
language plpgsql security invoker set search_path='' as $$
declare title text; template_name text; unique_key text;
begin
 if TG_OP='UPDATE' and new.status is not distinct from old.status then return new;end if;
 if TG_OP='INSERT' then template_name:='received';unique_key:=new.id::text||':received';
 else template_name:='decision';unique_key:=new.id::text||':'||new.status;end if;
 select e.title into title from public.events e where e.id=new.event_id;
 insert into public.listing_mail_outbox(request_id,template,recipient,payload,dedupe_key)
 values(new.id,template_name,new.email,jsonb_build_object('kind',new.kind,'status',new.status,'title',title,'reference',new.id),unique_key)
 on conflict(dedupe_key) do nothing;
 return new;
end $$;
revoke all on function public.enqueue_listing_mail() from public,anon,authenticated;
grant execute on function public.enqueue_listing_mail() to service_role;
create trigger enqueue_listing_mail after insert or update of status on public.listing_requests for each row execute function public.enqueue_listing_mail();

create function public.claim_listing_mail(p_limit integer default 3) returns setof public.listing_mail_outbox
language plpgsql security invoker set search_path='' as $$
begin
 update public.listing_mail_outbox set state='failed',lease_token=null,last_error='Verzending niet afgerond na vijf pogingen.' where state='sending' and attempts>=5 and claimed_at<now()-interval '10 minutes';
 return query update public.listing_mail_outbox m set state='sending',attempts=m.attempts+1,lease_token=gen_random_uuid(),claimed_at=now()
 where m.id in (select id from public.listing_mail_outbox
 where attempts<5 and ((state='pending' and next_attempt_at<=now()) or (state='sending' and claimed_at<now()-interval '10 minutes'))
 order by created_at limit least(10,greatest(1,p_limit)) for update skip locked)
 returning m.*;
end;
$$;
revoke all on function public.claim_listing_mail(integer) from public,anon,authenticated;
grant execute on function public.claim_listing_mail(integer) to service_role;
notify pgrst,'reload schema';
commit;
