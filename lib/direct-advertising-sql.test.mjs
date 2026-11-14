import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const migration='20261113091453_monthly_advertising_billing.sql';
async function setup(){
 const db=new PGlite();
 const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8').match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];await db.exec(fixture);
 await db.exec("alter role service_role bypassrls;create schema auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create function public.is_admin() returns boolean language sql as $$select false$$;");
 const files=['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','202610260001_additive_source_import.sql','20261030121700_verified_listing_claims.sql','20261030131817_listing_mail_outbox.sql','20261030153555_listing_admin_mail_notifications.sql','20261030214153_recover_existing_listing_management.sql','20261030145423_reserved_nourrissat_advertising_slot.sql','20261031184355_upgrade_existing_listing_advertising.sql','20261101093334_automatic_management_link_mail.sql','20261101100428_recover_legacy_multiple_management_links.sql','20261101102733_combined_listing_advertisements.sql','20261101104701_single_payment_advertising_selection.sql','20261101114028_municipal_directory_advertising.sql','20261101121333_municipal_calendar_read_isolation.sql','20261104170000_advertising_invoices.sql',migration,'20261113092631_monthly_billing_recovery.sql'];
 for(const f of files)await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await db.exec('alter table public.events add column archived_at timestamptz');
 await db.exec(readFileSync(new URL('../supabase/migrations/20261114110636_direct_advertiser_checkout.sql',import.meta.url),'utf8'));
 return db;
}

test('Direct advertising preserves content, never grants listing access, enforces pricing, idempotency and private billing',async()=>{
 const db=await setup();try{
 const eid=(await db.query("insert into events(title,slug,is_directory_entry,status,verified) values('Existing business','direct-test',true,'approved',true) returning id")).rows[0].id;
 const before=(await db.query('select to_jsonb(e) body from events e where id=$1',[eid])).rows[0].body;
 const ad={details:{name:'Test',email:'test@example.invalid',placements:['highlight']},startDate:'2099-01-31',endDate:'2099-02-28',months:1,amountCents:1500};
 const rid='00000000-0000-4000-8000-000000000014',hash='b'.repeat(64);
 const args=[rid,eid,hash,'encrypted','fr','iphash','mailhash',ad,true,true,'sepa','2026-11-13-monthly-v1'];
 const submit=(params=args)=>db.query('select request_public_advertising($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) id',params);
 assert.equal((await submit()).rows[0].id,rid);assert.equal((await submit()).rows[0].id,rid);
 assert.equal((await db.query('select count(*)::int n from advertising_requests')).rows[0].n,1);
 const after=(await db.query('select to_jsonb(e) body from events e where id=$1',[eid])).rows[0].body;for(const field of ['title','description','image_url','address','contact_phone','website_url','status','verified'])assert.deepEqual(after[field],before[field]);
 assert.equal((await db.query('select count(*)::int n from event_owner_access')).rows[0].n,0);
 assert.equal((await db.query('select method from advertising_contracts')).rows[0].method,'sepa');
 await assert.rejects(submit(['00000000-0000-4000-8000-000000000015',eid,'c'.repeat(64),'enc','fr','iphash','othermail',{...ad,amountCents:1},true,false,null,null]),/bedrag/);
 const another='00000000-0000-4000-8000-000000000016';
 await assert.rejects(submit([another,eid,'d'.repeat(64),'enc','fr','iphash','othermail',ad,true,true,'sepa','wrong']),/toestemming/);
 assert.equal((await db.query('select count(*)::int n from advertiser_access')).rows[0].n,1);
 for(let i=20;i<24;i++)await submit(['00000000-0000-4000-8000-'+String(i).padStart(12,'0'),eid,String(i).repeat(32),'enc','fr','iphash','mailhash',ad,true,false,null,null]);
 await assert.rejects(submit(['00000000-0000-4000-8000-000000000025',eid,'e'.repeat(64),'enc','fr','iphash','mailhash',ad,true,false,null,null]),/Te veel/);
 await db.query("update events set status='rejected' where id=$1",[eid]);
 await assert.rejects(submit([another,eid,'d'.repeat(64),'enc','fr','iphash','othermail',ad,true,false,null,null]),/beschikbaar/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from advertiser_access'),/permission denied/);await assert.rejects(submit(),/permission denied/);await db.exec('reset role');}
 }finally{await db.close()}
});
