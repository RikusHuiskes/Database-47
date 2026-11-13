import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const migration='20261113091453_monthly_advertising_billing.sql';
async function setup(){
 const db=new PGlite();
 const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8').match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];await db.exec(fixture);
 await db.exec("alter role service_role bypassrls;create schema auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create function public.is_admin() returns boolean language sql as $$select false$$;");
 const files=['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','202610260001_additive_source_import.sql','20261030121700_verified_listing_claims.sql','20261030131817_listing_mail_outbox.sql','20261030153555_listing_admin_mail_notifications.sql','20261030214153_recover_existing_listing_management.sql','20261030145423_reserved_nourrissat_advertising_slot.sql','20261031184355_upgrade_existing_listing_advertising.sql','20261101093334_automatic_management_link_mail.sql','20261101100428_recover_legacy_multiple_management_links.sql','20261101102733_combined_listing_advertisements.sql','20261101104701_single_payment_advertising_selection.sql','20261101114028_municipal_directory_advertising.sql','20261101121333_municipal_calendar_read_isolation.sql','20261104170000_advertising_invoices.sql',migration,'20261113092631_monthly_billing_recovery.sql'];
 for(const f of files)await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 return db;
}
test('Real SQL: monthly card and SEPA, duplicate callbacks, invoices, month ends, cancellation and service-only access',async()=>{
 const db=await setup();try{
  const eid=(await db.query("insert into events(title,slug,is_directory_entry,status,verified) values('Monthly fixture','monthly-fixture',true,'approved',true) returning id")).rows[0].id;
  await db.query('insert into event_owner_access(event_id,token_hash) values($1,$2)',[eid,'a'.repeat(64)]);
  const request=(await db.query("insert into advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents)values($1,'highlight',$2,'2099-01-31','2099-02-28',1,1500)returning id",[eid,{name:'Fixture',email:'fixture@example.invalid',placements:['highlight']}])).rows[0].id;
  const prepare=()=>db.query("select prepare_monthly_contract($1,'creditcard','2026-11-13-monthly-v1','fr',true) as id",[request]);
  const cid=(await prepare()).rows[0].id;assert.equal((await prepare()).rows[0].id,cid);
  await assert.rejects(db.query("select prepare_monthly_contract($1,'paypal','wrong','fr',true)",[request]),/toestemming/);
  await db.query("update advertising_contracts set customer_id='cst_fixture' where id=$1",[cid]);
  const cycle=(await db.query('select * from advertising_billing_cycles where contract_id=$1',[cid])).rows[0];
  assert.equal((await db.query('select claim_monthly_first($1) ok',[cycle.id])).rows[0].ok,true);
  assert.equal((await db.query('select claim_monthly_first($1) ok',[cycle.id])).rows[0].ok,false);
  await db.query("select apply_monthly_payment($1,'tr_fixture','paid','mdt_fixture')",[cycle.id]);
  await db.query("select apply_monthly_payment($1,'tr_fixture','open',null)",[cycle.id]);
  assert.equal((await db.query('select state from advertising_billing_cycles where id=$1',[cycle.id])).rows[0].state,'paid');
  assert.equal((await db.query("select count(*)::int n from advertising_billing_mail where kind='confirmed'")).rows[0].n,1);
  const profile={seller:{name:'Côte de Duras',address:'Fixture 1',postcode:'47120',city:'Duras',siret:'fixture'},taxMode:'franchise_exempt',vatRate:0,priceBasis:'tax_inclusive',taxNote:'TVA non applicable, article 293 B du CGI'};
  const invoice=(await db.query('select issue_advertising_invoice($1,$2,true) id',[request,profile])).rows[0].id;
  assert.equal((await db.query('select total_cents from advertising_invoices where id=$1',[invoice])).rows[0].total_cents,1500);
  await assert.rejects(db.query('select issue_advertising_invoice($1,$2,true)',[request,profile]),/bestaat al/);
  assert.equal((await db.query('select queue_monthly_cycles(true,40) result')).rows[0].result.queued,1);
  assert.equal((await db.query('select queue_monthly_cycles(true,40) result')).rows[0].result.queued,0);
  const next=(await db.query('select id from advertising_billing_cycles where contract_id=$1 and cycle_index=1',[cid])).rows[0].id;
  const second=(await db.query('select * from advertising_billing_cycles where id=$1',[next])).rows[0];
  assert.equal(second.starts_on.toISOString().slice(0,10),'2099-02-28');assert.equal(second.ends_on.toISOString().slice(0,10),'2099-03-31');
  assert.equal((await db.query('select reserve_monthly_cycle($1) id',[cid])).rows[0].id,null);
  assert.equal((await db.query('select claim_monthly_charge($1) ok',[second.id])).rows[0].ok,false);
  await db.query('select cancel_monthly_contract($1)',[cid]);await db.query('select cancel_monthly_contract($1)',[cid]);
  assert.equal((await db.query('select state from advertising_billing_cycles where id=$1',[second.id])).rows[0].state,'cancelled');
  assert.equal((await db.query("select count(*)::int n from advertising_billing_mail where kind='cancelled'")).rows[0].n,1);
  assert.equal((await db.query('select payment_status from advertising_requests where id=$1',[request])).rows[0].payment_status,'paid');
  assert.equal((await db.query('select reserve_monthly_cycle($1) id',[cid])).rows[0].id,null);
  await assert.rejects(db.query("select apply_monthly_payment($1,'tr_unwanted','paid','mdt_fixture')",[second.id]),/opgezegd/);
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from advertising_contracts'),/permission denied/);await assert.rejects(db.query('select cancel_monthly_contract($1)',[cid]),/permission denied/);await db.exec('reset role');}
 }finally{await db.close()}
});
