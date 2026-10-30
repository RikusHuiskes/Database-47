import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('House reservations leave eight paid slots, enforce category capacity and allow adjacent periods',async()=>{
 const db=new PGlite();try{
  const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8').match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];await db.exec(fixture);
  for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec("insert into events(id,title,slug,start_at,status,verified,is_manual_entry)values('1f4ce2cd-398d-45ab-989c-15c128818cca','Gîte','own','2025-01-01','approved',true,true)");
  await db.exec(readFileSync(new URL('../supabase/migrations/20261030145423_reserved_nourrissat_advertising_slot.sql',import.meta.url),'utf8'));
  const home=(await db.query('select * from events where reserved_homepage')).rows[0];assert.equal(home.is_directory_entry,true);assert.equal(home.start_at,null);assert(home.reserved_category_id);
  const ids=[];for(let i=0;i<9;i++){
   const id=(await db.query("insert into events(title,slug,start_at,is_directory_entry,promotion_type,promotion_status,promotion_start_at,promotion_end_at)values($1,$1,null,true,'homepage',$2,'2099-01-01T00:00:00+01:00','2099-01-02T00:00:00+01:00')returning id",['ad-'+i,i<8?'active':'requested'])).rows[0].id;ids.push(id);
   await db.query('insert into event_categories(event_id,category_id) values($1,$2)',[id,home.reserved_category_id]);
  }
  await assert.rejects(db.query("select assert_advertising_capacity($1,'homepage','2099-01-01','2099-01-02')",[ids[8]]),/maximaal 8/);
  await db.query("select assert_advertising_capacity($1,'homepage','2099-01-02','2099-01-03')",[ids[8]]);
  for(const id of ids.slice(0,8))await db.query("insert into advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents,payment_status)values($1,'category','{}','2099-01-01','2099-01-02',1,7900,'paid')",[id]);
  await assert.rejects(db.query("insert into advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents,payment_status)values($1,'category','{}','2099-01-01','2099-01-02',1,7900,'open')",[ids[8]]),/maximaal 8/);
  await db.query("select assert_advertising_capacity($1,'category','2099-01-02','2099-01-03')",[ids[8]]);
  await db.query("select assert_advertising_capacity($1,'highlight','2099-01-01','2099-01-02')",[ids[8]]);
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select assert_advertising_capacity($1,'homepage','2099-01-01','2099-01-02')",[ids[8]]),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();}
});
