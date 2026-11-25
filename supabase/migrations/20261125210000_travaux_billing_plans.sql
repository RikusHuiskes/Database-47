begin;
alter table public.travaux_providers add column billing_plan text check (billing_plan in ('monthly','annual'));
update public.travaux_providers set billing_plan='monthly' where first_payment_id is not null or subscription_id is not null;

alter table public.advertising_invoices alter column request_id drop not null;
alter table public.advertising_invoices add column travaux_payment_id text unique references public.travaux_payments(id) on delete restrict;
alter table public.advertising_invoices add constraint invoice_one_origin check (num_nonnulls(request_id,travaux_payment_id)=1);

create or replace function public.travaux_paid(p_user uuid, p_test boolean)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.travaux_providers a join public.travaux_payments p on p.provider_id = a.user_id
    where a.user_id = p_user and a.test_mode = p_test and p.paid
      and (now() at time zone 'Europe/Paris')::date >= p.starts_on
      and (now() at time zone 'Europe/Paris')::date < p.ends_on
  );
$$;

create function public.travaux_settle_payment(p_id text,p_user uuid,p_day date,p_plan text,p_paid boolean,p_observed timestamptz,p_profile jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  provider public.travaux_providers%rowtype;
  payment public.travaux_payments%rowtype;
  invoice uuid;
  gross integer;
  net integer;
  rate numeric;
  issue_time timestamptz := now();
  sequence_no bigint;
  invoice_no text;
  buyer jsonb;
begin
  if p_plan is null or p_plan not in ('monthly','annual') then raise exception 'Invalid billing plan'; end if;
  select * into strict provider from public.travaux_providers where user_id=p_user for update;
  insert into public.travaux_payments as previous(id,provider_id,starts_on,ends_on,paid,observed_at)
    values(p_id,p_user,p_day,(p_day + make_interval(months=>case when p_plan='annual' then 12 else 1 end))::date,p_paid,p_observed)
    on conflict(id) do update set paid=excluded.paid,observed_at=excluded.observed_at
    where previous.provider_id=excluded.provider_id and previous.observed_at<=excluded.observed_at;
  select * into strict payment from public.travaux_payments where id=p_id;
  if payment.provider_id<>p_user then raise exception 'Payment owner mismatch'; end if;
  if not p_paid or not payment.paid then return null; end if;
  select id into invoice from public.advertising_invoices where travaux_payment_id=p_id;
  if found then return invoice; end if;
  gross:=case when p_plan='annual' then 25000 else 2500 end;
  if p_profile is null or coalesce(p_profile->>'taxMode','') not in ('standard','franchise_exempt')
     or coalesce(p_profile->'seller'->>'siret','')='' or coalesce(p_profile->>'taxNote','')=''
     or coalesce(provider.details->>'siret','')='' then raise exception 'Incomplete invoice details'; end if;
  rate:=(p_profile->>'vatRate')::numeric;
  net:=case when p_profile->>'taxMode'='standard' then round(gross/(1+rate/100)) else gross end;
  buyer:=jsonb_build_object('name',provider.name,'company',provider.name,'email',provider.email,
    'address',concat_ws(', ',provider.details->>'address',nullif(provider.details->>'complement','')),
    'postcode',provider.details->>'postcode','city',provider.details->>'city','country','FR','siret',provider.details->>'siret');
  if provider.test_mode then
    invoice_no:='TEST-TRAVAUX-'||p_id;
  else
    update public.advertising_invoice_numbering set last_number=last_number+1 where id=1 returning last_number into sequence_no;
    if sequence_no is null then raise exception 'Missing invoice numbering'; end if;
    invoice_no:='CDD-'||to_char(issue_time at time zone 'Europe/Paris','YYYY')||'-'||lpad(sequence_no::text,6,'0');
  end if;
  insert into public.advertising_invoices(travaux_payment_id,invoice_number,issued_at,is_test_mode,net_cents,vat_cents,total_cents,snapshot)
  values(p_id,invoice_no,issue_time,provider.test_mode,net,gross-net,gross,jsonb_build_object(
    'invoiceNumber',invoice_no,'issuedAt',issue_time,'currency','EUR','seller',p_profile->'seller','customer',buyer,
    'lineDescription',case when p_plan='annual' then 'Abonnement Travaux — 12 mois' else 'Abonnement Travaux — 1 mois (SEPA)' end,
    'startsOn',payment.starts_on,'endsOn',payment.ends_on,'netCents',net,'vatCents',gross-net,'totalCents',gross,
    'vatRate',rate,'taxMode',p_profile->>'taxMode','taxNote',p_profile->>'taxNote')) returning id into invoice;
  insert into public.advertising_invoice_mail_outbox(invoice_id,recipient) values(invoice,provider.email);
  return invoice;
end $$;

revoke all on function public.travaux_settle_payment(text,uuid,date,text,boolean,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.travaux_settle_payment(text,uuid,date,text,boolean,timestamptz,jsonb) to service_role;

create or replace function public.advertising_invoice_summary()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'invoiceCount',(select count(*) from public.advertising_invoices where request_id is not null and not is_test_mode and state='issued'),
    'invoicedTotalCents',(select coalesce(sum(total_cents),0) from public.advertising_invoices where request_id is not null and not is_test_mode and state='issued'),
    'unbilledRequestCount',(select count(*) from public.advertising_requests r where not is_test_mode and not exists(select 1 from public.advertising_invoices i where i.request_id=r.id)),
    'testCount',(select count(*) from public.advertising_requests where is_test_mode),
    'mailPending',(select count(*) from public.advertising_invoice_mail_outbox m join public.advertising_invoices i on i.id=m.invoice_id where i.request_id is not null and m.state in ('pending','sending')),
    'mailFailed',(select count(*) from public.advertising_invoice_mail_outbox m join public.advertising_invoices i on i.id=m.invoice_id where i.request_id is not null and m.state='failed')
  )
$$;
commit;
