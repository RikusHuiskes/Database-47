create function public.travaux_create(p_owner uuid, p_job jsonb, p_contact jsonb, p_submission uuid)
returns uuid language plpgsql set search_path = '' as $$
begin
  insert into public.travaux_jobs (id, owner_id, title, description, category, commune)
  values (p_submission, p_owner, p_job->>'title', p_job->>'description', p_job->>'category', p_job->>'commune')
  on conflict (id) do nothing;

  if found then
    insert into public.travaux_contacts (job_id, name, address, email, phone)
    values (p_submission, p_contact->>'name', p_contact->>'address', p_contact->>'email', p_contact->>'phone');
  elsif not exists (select 1 from public.travaux_jobs where id = p_submission and owner_id = p_owner) then
    raise exception 'Invalid submission';
  end if;

  return p_submission;
end;
$$;

revoke execute on function public.travaux_create(uuid,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.travaux_create(uuid,jsonb,jsonb,uuid) to service_role;
