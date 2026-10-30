create or replace function public.review_listing_request(p_id uuid,p_action text,p_note text,p_contact text,p_token_hash text,p_reviewer uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
 r public.listing_requests%rowtype;
 previous_request public.listing_requests%rowtype;
 access_count integer;
begin
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
