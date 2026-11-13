import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Archiving hides invoiced listings, preserves financial records and survives importer updates; cleanup does not abort',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema auth;
   create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
   create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
   create table public.events(id uuid primary key,status text,verified boolean,promotion_status text,reserved_homepage boolean,reserved_category_id uuid,advertising_placements jsonb,updated_at timestamptz,start_at timestamptz,end_at timestamptz);
   create table public.advertising_requests(id uuid primary key,event_id uuid references public.events(id) on delete cascade);
   create table public.advertising_invoices(id uuid primary key,request_id uuid references public.advertising_requests(id) on delete restrict);
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261113114708_archive_events_preserving_invoices.sql',import.meta.url),'utf8'));
  const id=crypto.randomUUID(),request=crypto.randomUUID(),invoice=crypto.randomUUID();
  await db.query("insert into public.events(id,status,verified,promotion_status,reserved_homepage,advertising_placements,start_at) values($1,'approved',true,'active',true,'[{\"placement\":\"homepage\"}]',now()-interval '7 days')",[id]);
  await db.query('insert into public.advertising_requests values($1,$2)',[request,id]);
  await db.query('insert into public.advertising_invoices values($1,$2)',[invoice,request]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.archive_event($1)',[id]),/Beheerderstoegang/);
  await db.exec("reset role;set test.admin='true';set role authenticated");
  assert.equal((await db.query('select public.archive_event($1) as id',[id])).rows[0].id,id);
  await db.exec('reset role');
  const archived=(await db.query('select * from public.events where id=$1',[id])).rows[0];
  assert(archived.archived_at);assert.equal(archived.status,'rejected');assert.equal(archived.verified,false);assert.equal(archived.promotion_status,'ended');assert.equal(archived.reserved_homepage,false);assert.deepEqual(archived.advertising_placements,[]);
  await db.query("update public.events set status='approved',verified=true,promotion_status='active' where id=$1",[id]);
  assert.equal((await db.query('select status from public.events where id=$1',[id])).rows[0].status,'rejected');
  const other=crypto.randomUUID(),linked=crypto.randomUUID(),req2=crypto.randomUUID();
  for(const x of [other,linked])await db.query("insert into public.events(id,start_at) values($1,now()-interval '2 days')",[x]);
  await db.query('insert into public.advertising_requests values($1,$2)',[req2,linked]);
  await db.query('insert into public.advertising_invoices values($1,$2)',[crypto.randomUUID(),req2]);
  assert.equal((await db.query('select public.delete_expired_events() as n')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int as n from public.advertising_invoices')).rows[0].n,2);
  await db.exec("set test.role='service_role';set test.admin='false'");
  await db.query('select public.archive_event($1)',[id]);
  assert.equal((await db.query('select public.delete_expired_events_cron() as n')).rows[0].n,0);
  await assert.rejects(db.query('select public.archive_event($1)',[crypto.randomUUID()]),/niet gevonden/);
  const grant=(await db.query("select has_function_privilege('anon','public.archive_event(uuid)','execute') as can_archive")).rows[0];assert.equal(grant.can_archive,false);
 }finally{await db.close();}
});
