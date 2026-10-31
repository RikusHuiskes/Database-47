import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {stripTypeScriptTypes} from 'node:module';
import {advertisingQuote,validateAdvertiser,emptyAdvertiser} from './advertising.ts';

const migration='20261031184355_upgrade_existing_listing_advertising.sql';
const details={...emptyAdvertiser,name:'Test ondernemer',address:'Teststraat 1',postcode:'47120',city:'Duras',email:'test@example.invalid',phone:'123',startDate:'2099-01-31',months:1};
const ad={...advertisingQuote('highlight',details),details};
test('Upgrading preserves the existing listing, authenticates ownership, prevents duplicate orders and waits for payment',async()=>{
 const db=new PGlite();try{
  const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8').match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];await db.exec(fixture);
  await db.exec('alter role service_role bypassrls;grant select,update on events to service_role;grant select on event_categories to service_role');
  for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','20261030145423_reserved_nourrissat_advertising_slot.sql',migration])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const id=(await db.query("insert into events(title,slug,start_at,status,verified,is_manual_entry)values('Kerstdiner','kerstdiner','2099-12-25','approved',true,true)returning id")).rows[0].id;
  await db.query('insert into event_owner_access(event_id,token_hash)values($1,$2)',[id,'a'.repeat(64)]);
  const call=(hash='a'.repeat(64),placement='highlight',quote=ad)=>db.query('select upgrade_managed_advertising($1,$2,$3,$4) as id',[id,hash,placement,quote]);
  await db.exec('set role anon');await assert.rejects(call(),/permission denied/);await db.exec('reset role;set role service_role');
  await assert.rejects(call('b'.repeat(64)),/beheerlink/);
  await assert.rejects(call(undefined,undefined,{...ad,amountCents:1}),/Ongeldige advertentie/);
  const requestId=(await call()).rows[0].id;assert.equal((await call()).rows[0].id,requestId);
  await db.exec('reset role');
  let row=(await db.query('select * from events where id=$1',[id])).rows[0];
  assert.equal(row.title,'Kerstdiner');assert.equal(row.status,'approved');assert.equal(row.verified,true);assert.equal(row.promotion_status,'requested');
  assert.equal((await db.query('select count(*)::int n from events')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from advertising_requests')).rows[0].n,1);
  await assert.rejects(call(undefined,'homepage',{...ad,...advertisingQuote('homepage',details)}),/lopende advertentieaanvraag/);
  await db.query("update advertising_requests set mollie_payment_id='tr_upgrade' where id=$1",[requestId]);
  await db.query("select settle_advertising_payment('tr_upgrade','paid')");
  row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(row.promotion_status,'active');assert.equal(row.promotion_type,'highlight');
  // An old paid period must not make the next, unpaid upgrade visible.
  await db.query("update advertising_requests set starts_on='2020-01-01',ends_on='2020-02-01' where id=$1",[requestId]);
  await db.query("update events set promotion_status='ended',promotion_end_at='2020-02-01' where id=$1",[id]);
  const renewal={...details,startDate:'2099-03-01'};
  await call(undefined,'highlight',{...advertisingQuote('highlight',renewal),details:renewal});
  row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(row.promotion_status,'requested');
  assert.equal((await db.query('select count(*)::int n from events')).rows[0].n,1);
 }finally{await db.close();}
});

test('Upgrade API rejects unauthenticated and cross-origin requests and ignores a client-supplied price',async()=>{
 const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/managed-event/advertising/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export ','');
 let args;
 const q={select(){return q},eq(){return q},single:async()=>({data:{id:'request',amount_cents:1500,payment_status:'requested'}})};
 const client={rpc:async(name,input)=>{assert.equal(name,'upgrade_managed_advertising');args=input;return {data:'request'}},from:()=>q};
 const make=access=>new Function('managedAccess','tokenHash','validateAdvertiser',source+';return POST;')(access,()=> 'a'.repeat(64),validateAdvertiser);
 const request=(origin='https://site.invalid')=>new Request('https://site.invalid/api/managed-event/advertising',{method:'POST',headers:{origin,authorization:'Bearer '+ 'a'.repeat(43)},body:JSON.stringify({eventId:'existing',placement:'highlight',advertiser:details,amountCents:1})});
 assert.equal((await make(async()=>null)(request())).status,401);
 assert.equal((await make(async()=>client)(request('https://evil.invalid'))).status,403);
 assert.equal((await make(async()=>client)(request())).status,200);
 assert.equal(args.p_event_id,'existing');assert.equal(args.p_ad.amountCents,1500);assert.equal(args.p_ad.endDate,'2099-02-28');
});
