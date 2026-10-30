begin;
create function public.enqueue_listing_admin_mail() returns trigger
language plpgsql security invoker set search_path='' as $$
declare listing_title text;
begin
 select title into listing_title from public.events where id=new.event_id;
 insert into public.listing_mail_outbox(request_id,template,recipient,payload,dedupe_key)
 values(new.id,'received','info@cotededuras.com',jsonb_build_object('audience','admin','kind',new.kind,'status',new.status,'title',listing_title,'reference',new.id),new.id::text||':admin:received')
 on conflict(dedupe_key) do nothing;
 return new;
end $$;
revoke all on function public.enqueue_listing_admin_mail() from public,anon,authenticated;
grant execute on function public.enqueue_listing_admin_mail() to service_role;
create trigger enqueue_listing_admin_mail after insert on public.listing_requests for each row execute function public.enqueue_listing_admin_mail();
commit;
