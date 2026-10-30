import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {listingTriage} from './listing-triage.ts';
import {listingRequestInput} from './listing-request.ts';

test('Request input cannot grant rights, impersonate approval, or omit consent',()=>{
 const input={eventId:'11111111-1111-4111-8111-111111111111',kind:'claim',name:'Eigenaar',email:'owner@example.invalid',organization:'Gîte',message:'Ik ben de eigenaar',consent:true,status:'approved',token_hash:'fake'};
 const result=listingRequestInput(input);assert.equal(result.status,'pending');assert.equal(result.token_hash,undefined);
 assert.throws(()=>listingRequestInput({...input,consent:false}));
 assert.throws(()=>listingRequestInput({...input,website:'spam'}));
 assert.throws(()=>listingRequestInput({...input,kind:'admin'}));
});

test('Claim, correction, access revocation, private history and additive imports',async()=>{
 const db=new PGlite();
 try{
  // Reuse the existing schema fixture, then execute the real migrations.
  const existing=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8');
  const schema=existing.match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];
  await db.exec(schema);await db.exec('alter role service_role bypassrls');
  await db.exec("create schema auth;create function auth.role() returns text language sql as $$select 'service_role'::text$$;create function public.is_admin() returns boolean language sql as $$select false$$;");
  for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','202610260001_additive_source_import.sql','20261030121700_verified_listing_claims.sql','20261030131817_listing_mail_outbox.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec('grant select,update on events to service_role;grant select on event_categories to service_role;');
  const source='https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-sites-viticoles.csv#CLAIMTEST';
  const id=(await db.query("insert into events(title,slug,city,source_url,is_directory_entry,is_manual_entry,status,verified)values('Château','claim-test','Duras',$1,true,false,'approved',true)returning id",[source])).rows[0].id;
  const category=(await db.query("select id from categories where slug='wijnhuizen'")).rows[0].id;
  const request={event_id:id,kind:'claim',name:'Eigenaar',email:'owner@example.invalid',organization:'Château',message:'Ik ben de eigenaar'};
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   for(const table of ['listing_requests','listing_change_history','listing_review_history','listing_mail_outbox'])for(const sql of [`select * from ${table}`,`delete from ${table}`,`update ${table} set id=gen_random_uuid()`,`insert into ${table}(id) values(gen_random_uuid())`])await assert.rejects(db.exec(sql),/permission denied/);
   await assert.rejects(db.query('select submit_listing_request($1)',[request]),/permission denied/);
   await assert.rejects(db.query('select review_listing_request($1,$2,$3,$4,$5)',[id,'approved','Gecontroleerd via telefoon','officiële bron','a'.repeat(64)]),/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const rid=(await db.query('select submit_listing_request($1) as id',[request])).rows[0].id;
  assert.equal((await db.query('select count(*)::int n from listing_mail_outbox')).rows[0].n,1);
  const mailBatch=(await db.query('select * from claim_listing_mail(1)')).rows;assert.equal(mailBatch.length,1);assert.equal(mailBatch[0].attempts,1);
  assert.equal((await db.query('select * from claim_listing_mail(1)')).rows.length,0);
  await db.query("update listing_mail_outbox set claimed_at=now()-interval '11 minutes' where id=$1",[mailBatch[0].id]);
  const retried=(await db.query('select * from claim_listing_mail(1)')).rows;assert.equal(retried[0].attempts,2);assert.notEqual(retried[0].lease_token,mailBatch[0].lease_token);
  assert.equal((await db.query('select count(*)::int n from event_owner_access')).rows[0].n,0);
  await assert.rejects(db.query('select submit_listing_request($1)',[request]),/al een verzoek/);
  await assert.rejects(db.query('select update_managed_event($1,$2,$3)',[id,{title:'Onbevoegd'},category]),/kan niet worden gewijzigd/);
  await assert.rejects(db.query('select review_listing_request($1,$2,$3,$4,$5)',[rid,'approved','Gecontroleerd via telefoon','','a'.repeat(64)]),/contactadres/);
  await db.query('select review_listing_request($1,$2,$3,$4,$5)',[rid,'approved','Gebeld via de officiële website op 30 oktober','https://example.invalid/contact + gepubliceerd nummer','a'.repeat(64)]);
  const duplicateClaim=(await db.query('select submit_listing_request($1) id',[{...request,email:'second@example.invalid'}])).rows[0].id;
  await assert.rejects(db.query('select review_listing_request($1,$2,$3,$4,$5)',[duplicateClaim,'approved','Onafhankelijk gecontroleerde tweede aanvraag','https://example.invalid/contact','d'.repeat(64)]),/al beheerrechten/);
  assert.equal((await db.query('select count(*)::int n from event_owner_access')).rows[0].n,1);
  await db.query('select update_managed_event($1,$2,$3)',[id,{title:'Eigen tekst',city:'Duras',source_url:'https://attacker.invalid',description:'Nieuwe beschrijving'},category]);
  let row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(row.source_url,source);assert.equal(row.title,'Eigen tekst');assert.equal(row.is_manual_entry,false);assert.equal(row.status,'approved');
  assert.equal((await db.query('select count(*)::int n from listing_change_history where event_id=$1',[id])).rows[0].n,1);
  const imported=await db.query('select import_directory_entries($1) result',[[{source_id:'CLAIMTEST',source_url:source,title:'Oude bronnaam',category_slug:'wijnhuizen',city:'Duras'}]]);
  assert.equal(imported.rows[0].result.skipped,1);assert.equal((await db.query('select title from events where id=$1',[id])).rows[0].title,'Eigen tekst');
  const correction=(await db.query('select submit_listing_request($1) id',[{...request,kind:'correction',email:'visitor@example.invalid'}])).rows[0].id;
  await assert.rejects(db.query('select review_listing_request($1,$2,$3,$4,$5)',[correction,'approved','Een correctie geeft geen rechten','https://example.invalid','b'.repeat(64)]),/open beheeraanvraag/);
  await db.query('select review_listing_request($1,$2,$3,$4,$5)',[correction,'resolved','Correctie gecontroleerd en afgehandeld','','b'.repeat(64)]);
  assert.equal((await db.query('select count(*)::int n from event_owner_access')).rows[0].n,1);
  await db.query('select review_listing_request($1,$2,$3,$4,$5)',[rid,'revoked','Toegang ingetrokken na verzoek eigenaar','','c'.repeat(64)]);
  assert.equal((await db.query('select count(*)::int n from event_owner_access')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from listing_review_history where request_id=$1',[rid])).rows[0].n,2);
  await assert.rejects(db.query('select update_managed_event($1,$2,$3)',[id,{title:'Geen toegang'},category]),/kan niet worden gewijzigd/);
 }finally{await db.close();}
});

test('Automated triage is a suggestion and never equates email/domain matching with ownership',()=>{
 const request={kind:'claim',email:'owner@chateau.fr',created_at:new Date().toISOString(),events:{website_url:'https://www.chateau.fr/'}};
 assert.equal(listingTriage(request).route,'contact_verification');
 assert.equal(listingTriage({...request,email:'fake@chateau.fr.attacker.com'}).route,'independent_check');
 assert.equal(listingTriage({...request,email:'a@gmail.com',events:{website_url:'https://gmail.com'}}).route,'independent_check');
 assert.equal(listingTriage({...request,kind:'correction'}).route,'correction');
});
