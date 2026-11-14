begin;
-- Recover only contracts that genuinely lack their next period, avoiding batch starvation.
create function public.queue_monthly_cycles(p_test boolean,p_limit integer default 40) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c record;queued integer:=0;failed integer:=0;bid uuid;
begin
 for c in select a.id from public.advertising_contracts a where a.status='active' and a.is_test_mode=p_test
  and not exists(select 1 from public.advertising_billing_cycles b where b.contract_id=a.id and b.state<>'paid')
  order by a.paid_until,a.id limit least(greatest(p_limit,1),100) for update of a skip locked loop
  begin
   bid:=public.reserve_monthly_cycle(c.id);if bid is not null then queued:=queued+1;end if;
  exception when others then failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('queued',queued,'failed',failed);
end $$;
revoke all on function public.queue_monthly_cycles(boolean,integer) from public,anon,authenticated;
grant execute on function public.queue_monthly_cycles(boolean,integer) to service_role;
notify pgrst,'reload schema';
commit;
