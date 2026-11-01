import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {advertisingSelectionQuote,emptyAdvertiser} from './advertising.ts';
const dir='../supabase/migrations/';
const bill={...emptyAdvertiser,name:'Test ondernemer',address:'Teststraat 1',postcode:'47120',city:'Duras',phone:'123',email:'test@example.invalid',startDate:'2099-01-01',months:1};
const input=(placements)=>{const q=advertisingSelectionQuote(placements,bill);return {...q,details:{...bill,placements:q.placements}}};
async function setup(){const db=new PGlite();const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8').match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];await db.exec(fixture);await db.exec("alter role service_role bypassrls;create schema auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create function public.is_admin() returns boolean language sql as $$select false$$;");
for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','202610260001_additive_source_import.sql','20261030121700_verified_listing_claims.sql','20261030131817_listing_mail_outbox.sql','20261030153555_listing_admin_mail_notifications.sql','20261030214153_recover_existing_listing_management.sql','20261030145423_reserved_nourrissat_advertising_slot.sql','20261031184355_upgrade_existing_listing_advertising.sql','20261101093334_automatic_management_link_mail.sql','20261101100428_recover_legacy_multiple_management_links.sql','20261101102733_combined_listing_advertisements.sql','20261101104701_single_payment_advertising_selection.sql','20261101114028_municipal_directory_advertising.sql','20261101121333_municipal_calendar_read_isolation.sql'])await db.exec(readFileSync(new URL(dir+file,import.meta.url),'utf8'));return db;}
const listing=(key='estate-test',code='47086',type='estate_agent')=>({key,code,type,title:'Test makelaar',city:code==='47086'?'Duras':'Libourne',address:'1 Teststraat',source_url:'https://agency.example.invalid/contact',website:'https://agency.example.invalid',phone:'123',email:'agency@example.invalid',hours:'Ma–vr'});
test('Municipal registration is idempotent, protected, separate from calendar and never grants owner access',async()=>{const db=await setup();try{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select register_municipal_listing($1)',[listing()]),/permission denied/);await db.exec('reset role');}
 const register=async value=>(await db.query('select register_municipal_listing($1) id',[value])).rows[0].id;
 const id=await register(listing());assert.equal(await register({...listing(),title:'Overwrite attempt'}),id);
 assert.equal((await db.query('select title from events where id=$1',[id])).rows[0].title,'Test makelaar');assert.equal((await db.query('select count(*)::int n from event_owner_access')).rows[0].n,0);
 await register(listing('branch-2','33243'));await db.exec('grant select on events to anon;set role anon');assert.equal((await db.query('select count(*)::int n from events')).rows[0].n,0);await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from events where municipal_key is null')).rows[0].n,0);
 await assert.rejects(db.query('select update_managed_event($1,$2,null)',[id,{title:'Denied',city:'Duras'}]),/niet worden gewijzigd/);
 const request=(await db.query('select submit_listing_request($1) id',[{event_id:id,kind:'claim',name:'Owner',email:'owner@example.invalid',organization:'Agency',message:'I am the verified owner of this agency'}])).rows[0].id;
 await db.query('select review_listing_request_with_mail($1,$2,$3,$4,$5,$6,$7,$8)',[request,'approved','Official source verified with owner','https://agency.example.invalid official telephone','a'.repeat(64),null,'owner@example.invalid','v1.fake-encrypted']);
 assert.equal((await db.query("select recipient from listing_mail_outbox where template='management'")).rows[0].recipient,'owner@example.invalid');
 const quote=input(['highlight','category','homepage']);const order=(await db.query('select request_managed_advertising_selection($1,$2,$3) id',[id,'a'.repeat(64),quote])).rows[0].id;
 assert.equal((await db.query('select count(*)::int n from event_categories where event_id=$1',[id])).rows[0].n,0);
 await db.query("update advertising_requests set mollie_payment_id='tr_municipal' where id=$1",[order]);await db.query("select settle_advertising_payment('tr_municipal','paid')");
 let event=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(event.advertising_placements.length,3);assert.equal(event.promotion_status,'active');
 await db.query('select update_managed_event($1,$2,null)',[id,{title:'Updated makelaar',city:'Duras',address:'1 Teststraat',source_url:'https://attacker.invalid',website_url:'https://agency.example.invalid',municipal_email:'new@example.invalid',municipal_hours:'Op afspraak'}]);
 event=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(event.source_url,listing().source_url);assert.equal(event.municipal_email,'new@example.invalid');assert.equal(event.advertising_placements.length,3);
 await assert.rejects(db.query('select update_managed_event($1,$2,null)',[id,{title:'Move',city:'Libourne'}]),/vestigingsgemeente/);
 }finally{await db.close();}});
test('Municipal advertising capacity is independent of calendar and scoped to municipality and service',async()=>{const db=await setup();try{
 for(let i=0;i<9;i++)await db.query("insert into events(title,slug,is_directory_entry,promotion_type,promotion_status,promotion_start_at,promotion_end_at)values($1,$1,true,'homepage','active','2099-01-01','2099-02-01')",['calendar-'+i]);
 const register=async value=>(await db.query('select register_municipal_listing($1) id',[value])).rows[0].id;
 const first=await register(listing('first'));await db.query('select assert_advertising_capacity($1,$2,$3,$4)',[first,'homepage','2099-01-01','2099-02-01']);
 for(let i=0;i<9;i++){const id=await register(listing('municipal-'+i));await db.query("insert into advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents,payment_status)values($1,'homepage','{}','2099-01-01','2099-02-01',1,14900,'paid')",[id]);}
 await assert.rejects(db.query('select assert_advertising_capacity($1,$2,$3,$4)',[first,'homepage','2099-01-01','2099-02-01']),/Geen advertentieplek/);
 await db.query('select assert_advertising_capacity($1,$2,$3,$4)',[first,'category','2099-01-01','2099-02-01']);
 const other=await register(listing('other-city','33243'));await db.query('select assert_advertising_capacity($1,$2,$3,$4)',[other,'homepage','2099-01-01','2099-02-01']);
 }finally{await db.close();}});
