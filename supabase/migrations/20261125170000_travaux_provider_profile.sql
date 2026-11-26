alter table public.travaux_providers
  add column if not exists details jsonb,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

alter table public.travaux_providers add constraint travaux_terms_pair
  check ((terms_version is null) = (terms_accepted_at is null));
