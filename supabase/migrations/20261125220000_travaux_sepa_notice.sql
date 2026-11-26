alter table public.travaux_providers add column notice_ends_on date;
alter table public.travaux_providers add constraint travaux_notice_requires_cancellation
  check (notice_ends_on is null or cancelled_at is not null);

create or replace function public.travaux_paid(p_user uuid, p_test boolean)
returns boolean language sql stable set search_path = '' as $$
  with local_day as (select (now() at time zone 'Europe/Paris')::date as today)
  select exists (
    select 1 from public.travaux_providers a join public.travaux_payments p on p.provider_id = a.user_id
    cross join local_day d
    where a.user_id = p_user and a.test_mode = p_test and p.paid
      and (
        (d.today >= p.starts_on and d.today < p.ends_on)
        or (
          a.billing_plan = 'monthly' and d.today < a.notice_ends_on
          and (a.cancelled_at at time zone 'Europe/Paris')::date >= p.starts_on
          and (a.cancelled_at at time zone 'Europe/Paris')::date < p.ends_on
        )
      )
  );
$$;
