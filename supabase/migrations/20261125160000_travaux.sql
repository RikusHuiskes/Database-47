begin;

create table public.travaux_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  commune text not null,
  status text not null default 'pending' check (status in ('pending','open','rejected','closed')),
  created_at timestamptz not null default now()
);
create table public.travaux_contacts (
  job_id uuid primary key references public.travaux_jobs on delete cascade,
  name text not null, address text not null, email text not null, phone text not null,
  consent_at timestamptz not null default now()
);
create table public.travaux_providers (
  user_id uuid primary key references auth.users on delete restrict,
  name text not null, email text not null, phone text not null,
  test_mode boolean not null,
  customer_id text unique,
  checkout_key uuid not null default gen_random_uuid(),
  first_payment_id text unique,
  subscription_id text unique,
  cancelled_at timestamptz
);
create table public.travaux_payments (
  id text primary key,
  provider_id uuid not null references public.travaux_providers on delete restrict,
  starts_on date not null,
  ends_on date not null,
  paid boolean not null,
  observed_at timestamptz not null
);
create table public.travaux_responses (
  job_id uuid not null references public.travaux_jobs on delete cascade,
  provider_id uuid not null references public.travaux_providers on delete restrict,
  slot smallint not null check (slot between 1 and 3),
  company text not null, email text not null, phone text not null,
  message text, quote_cents integer check (quote_cents > 0),
  primary key (job_id, provider_id),
  unique (job_id, slot)
);
create index on public.travaux_jobs (status, created_at desc);
create index on public.travaux_jobs (owner_id, created_at desc);
create index on public.travaux_responses (provider_id);
create index on public.travaux_payments (provider_id, ends_on) where paid;

alter table public.travaux_jobs enable row level security;
alter table public.travaux_contacts enable row level security;
alter table public.travaux_providers enable row level security;
alter table public.travaux_payments enable row level security;
alter table public.travaux_responses enable row level security;

revoke all on public.travaux_jobs, public.travaux_contacts, public.travaux_providers,
  public.travaux_payments, public.travaux_responses from public, anon, authenticated;
grant select, insert, update, delete on public.travaux_jobs, public.travaux_contacts,
  public.travaux_providers, public.travaux_payments, public.travaux_responses to service_role;

create function public.travaux_create(p_owner uuid, p_job jsonb, p_contact jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare job uuid;
begin
  insert into public.travaux_jobs (owner_id, title, description, category, commune)
  values (p_owner, p_job->>'title', p_job->>'description', p_job->>'category', p_job->>'commune')
  returning id into job;
  insert into public.travaux_contacts (job_id, name, address, email, phone)
  values (job, p_contact->>'name', p_contact->>'address', p_contact->>'email', p_contact->>'phone');
  return job;
end;
$$;

create function public.travaux_paid(p_user uuid, p_test boolean)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.travaux_providers a join public.travaux_payments p on p.provider_id = a.user_id
    where a.user_id = p_user and a.test_mode = p_test and a.subscription_id is not null and p.paid
      and (now() at time zone 'Europe/Paris')::date >= p.starts_on
      and (now() at time zone 'Europe/Paris')::date < p.ends_on
  );
$$;

create function public.travaux_respond(p_user uuid, p_job uuid, p_test boolean, p_message text, p_quote integer)
returns text language plpgsql set search_path = '' as $$
declare
  job public.travaux_jobs%rowtype;
  provider public.travaux_providers%rowtype;
  next_slot integer;
begin
  select * into job from public.travaux_jobs where id = p_job for update;
  if not found or job.owner_id = p_user then return 'unavailable'; end if;
  if exists (select 1 from public.travaux_responses where job_id = p_job and provider_id = p_user)
    then return 'already'; end if;
  if job.status <> 'open' then return 'unavailable'; end if;
  if not public.travaux_paid(p_user, p_test) then return 'subscription'; end if;
  select * into provider from public.travaux_providers where user_id = p_user;
  select coalesce(max(slot), 0) + 1 into next_slot from public.travaux_responses where job_id = p_job;
  if next_slot > 3 then return 'unavailable'; end if;
  insert into public.travaux_responses (job_id, provider_id, slot, company, email, phone, message, quote_cents)
  values (p_job, p_user, next_slot, provider.name, provider.email, provider.phone, p_message, p_quote);
  if next_slot = 3 then update public.travaux_jobs set status = 'closed' where id = p_job; end if;
  return 'accepted';
end;
$$;

create function public.travaux_record_payment(p_id text, p_user uuid, p_day date, p_paid boolean, p_observed timestamptz)
returns void language sql set search_path = '' as $$
  insert into public.travaux_payments as existing (id, provider_id, starts_on, ends_on, paid, observed_at)
  values (p_id, p_user, p_day, (p_day + interval '1 month')::date, p_paid, p_observed)
  on conflict (id) do update set paid = excluded.paid, observed_at = excluded.observed_at
  where existing.provider_id = excluded.provider_id and existing.observed_at <= excluded.observed_at;
$$;

revoke execute on function public.travaux_create(uuid,jsonb,jsonb), public.travaux_paid(uuid,boolean),
  public.travaux_respond(uuid,uuid,boolean,text,integer),
  public.travaux_record_payment(text,uuid,date,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.travaux_create(uuid,jsonb,jsonb), public.travaux_paid(uuid,boolean),
  public.travaux_respond(uuid,uuid,boolean,text,integer),
  public.travaux_record_payment(text,uuid,date,boolean,timestamptz) to service_role;
commit;
