import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {sealSubmissionMail,openSubmissionMail,managementMailTokenHash} from './management-mail.ts';

test('New event and municipal submissions queue their original owner link only on approval, atomically and once',async()=>{
 const db=new PGlite();
 try{
  const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8');
  await db.exec(fixture.match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1]);
  await db.exec("alter role service_role bypassrls;create schema auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create function public.is_admin() returns boolean language sql as $$select false$$;");
  for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','202610260001_additive_source_import.sql','20261030121700_verified_listing_claims.sql','20261030131817_listing_mail_outbox.sql','20261030153555_listing_admin_mail_notifications.sql','20261030214153_recover_existing_listing_management.sql','20261101093334_automatic_management_link_mail.sql','20261102110000_new_event_advertising_selection.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`alter table events add column municipal_key text,add column municipal_code text,add column municipal_type text,add column municipal_email text,add column municipal_hours text;
   alter table listing_mail_outbox alter column request_id drop not null;
   alter table listing_mail_outbox add column event_id uuid references events(id) on delete cascade;
   alter table listing_mail_outbox add constraint listing_mail_admin_activity_check check(request_id is not null or (payload->>'audience'='admin' and template='received' and recipient='info@cotededuras.com'));
   grant all on events,event_categories to service_role;grant select on categories to service_role;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261107180000_submission_approval_mail.sql',import.meta.url),'utf8'));
  const env={MANAGEMENT_MAIL_KEY:'isolated-approval-test'},token='t'.repeat(43),hash=managementMailTokenHash({token});
  const contact={recipient:'owner@example.invalid',locale:'fr',encrypted_secret:sealSubmissionMail({token,origin:'https://example.invalid'},env)};
  const event={title:'Only isolated test',city:'Duras',is_directory_entry:true,promotion_type:'none',website_url:'https://example.invalid',booking_url:'https://example.invalid',source_url:'https://example.invalid'};
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.exec('select * from listing_submission_contacts'),/permission denied/);
   await assert.rejects(db.query('select submit_managed_event_with_contact($1,null,$2,null,$3)',[event,hash,contact]),/permission denied/);
   await assert.rejects(db.exec('select queue_submission_approval_mail()'),/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const create=async(c=contact,h=hash)=>(await db.query('select submit_managed_event_with_contact($1,null,$2,null,$3) id',[event,h,c])).rows[0].id;
  await assert.rejects(create({...contact,recipient:'invalid'}));
  assert.equal((await db.query('select count(*)::int n from events')).rows[0].n,0,'bad contact rolls back event and ownership');
  const eid=await create();
  assert.equal((await db.query('select count(*)::int n from listing_mail_outbox')).rows[0].n,0);
  await db.query("update events set status='rejected',verified=false where id=$1",[eid]);
  assert.equal((await db.query('select count(*)::int n from listing_mail_outbox')).rows[0].n,0);
  await db.query("update events set status='approved',verified=true where id=$1",[eid]);
  let rows=(await db.query('select * from listing_mail_outbox')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].event_id,eid);assert.equal(rows[0].recipient,contact.recipient);assert.equal(rows[0].payload.locale,'fr');
  assert.equal(openSubmissionMail(rows[0].encrypted_secret,eid,env).token,token);
  assert.equal((await db.query('select token_hash from event_owner_access where event_id=$1',[eid])).rows[0].token_hash,hash);
  assert.equal((await db.query('select encrypted_secret from listing_submission_contacts where event_id=$1',[eid])).rows[0].encrypted_secret,null);
  assert(!JSON.stringify(rows[0].payload).includes(token));
  await db.query("update events set status='approved',verified=true where id=$1",[eid]);
  assert.equal((await db.query('select count(*)::int n from listing_mail_outbox')).rows[0].n,1);
  await db.query("update events set status='pending',verified=false where id=$1",[eid]);
  assert.equal((await db.query('select * from claim_listing_mail_v2(10)')).rows.length,0,'withdrawn publication must wait');
  await db.query("update events set status='approved',verified=true where id=$1",[eid]);
  assert.equal((await db.query('select * from claim_listing_mail_v2(10)')).rows.length,1);
  const revoked=await create(contact,'a'.repeat(64));await db.query('delete from event_owner_access where event_id=$1',[revoked]);
  await db.query("update events set status='approved',verified=true where id=$1",[revoked]);
  assert.equal((await db.query('select count(*)::int n from listing_mail_outbox')).rows[0].n,1,'revoked owner link is not queued');
  const business={id:'11111111-1111-4111-8111-111111111111',title:'Isolated shop',city:'Duras',municipal_key:'submitted:11111111-1111-4111-8111-111111111111',municipal_code:'47086',municipal_type:'bakery',municipal_email:'public-shop@example.invalid',status:'approved',verified:true,promotion_status:'active'};
  const submitBusiness=c=>db.query('select submit_municipal_listing_with_contact($1,$2,$3) id',[business,'b'.repeat(64),c]);
  await assert.rejects(submitBusiness({...contact,encrypted_secret:null}));
  assert.equal((await db.query('select count(*)::int n from events where id=$1',[business.id])).rows[0].n,0);
  await submitBusiness({...contact,recipient:'private-shop-owner@example.invalid',locale:'en'});
  const saved=(await db.query('select * from events where id=$1',[business.id])).rows[0];assert.equal(saved.status,'pending');assert.equal(saved.verified,false);assert.equal(saved.promotion_status,'none');
  await db.query("update events set status='approved',verified=true where id=$1",[business.id]);
  rows=(await db.query('select * from listing_mail_outbox where event_id=$1',[business.id])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].recipient,'private-shop-owner@example.invalid');assert.notEqual(rows[0].recipient,saved.municipal_email);
  assert.equal((await db.query('select * from claim_submission_approval_mail($1)',[business.id])).rows.length,1);
  assert.equal((await db.query('select * from claim_submission_approval_mail($1)',[business.id])).rows.length,0,'a claimed approval cannot send twice');
  // Legacy/imported entries have no owner delivery record and produce no owner mail.
  const legacy=(await db.query("insert into events(title,slug,status,verified,is_manual_entry,start_at)values('Legacy','legacy','pending',false,false,now())returning id")).rows[0].id;
  await db.query("update events set status='approved',verified=true where id=$1",[legacy]);
  assert.equal((await db.query('select count(*)::int n from listing_mail_outbox where event_id=$1',[legacy])).rows[0].n,0);
 }finally{await db.close();}
});
