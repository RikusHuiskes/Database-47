import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {advertisingSelectionQuote,advertisingOrderTypes,ADVERTISING_LABELS,emptyAdvertiser,validateAdvertiser} from './advertising.ts';
import {prioritizeHighlighted} from './event-presentation.ts';
const selectionMigration='20261101104701_single_payment_advertising_selection.sql';
const details={...emptyAdvertiser,name:'Test ondernemer',address:'Teststraat 1',postcode:'47120',city:'Duras',email:'test@example.invalid',phone:'123',startDate:'2099-01-31',months:1};
const selected=['highlight','homepage','category'];
const quote=advertisingSelectionQuote(selected,details);
const ad={...quote,details:{...details,placements:quote.placements}};
async function database(){
 const db=new PGlite();const fixture=readFileSync(new URL('./owner-advertising.test.mjs',import.meta.url),'utf8').match(/await db.exec\(`(create role anon;[\s\S]*?)`\);/)[1];await db.exec(fixture);
 for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql','20261030145423_reserved_nourrissat_advertising_slot.sql','20261031184355_upgrade_existing_listing_advertising.sql','20261101102733_combined_listing_advertisements.sql',selectionMigration])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 return db;
}
test('Selection prices reject invalid or duplicate choices and sum the exact duration',()=>{
 assert.equal(quote.amountCents,24300);assert.equal(quote.endDate,'2099-02-28');
 assert.equal(advertisingSelectionQuote(['category','homepage'],{...details,months:3}).amountCents,68400);
 for(const value of [[],['highlight','highlight'],['invalid'],['toString'],null])assert.throws(()=>advertisingSelectionQuote(value,details));
 assert.deepEqual(advertisingOrderTypes({placement:'highlight'}),['highlight']);
});
test('Three placements produce one owned order, require one payment, activate together and refund together',async()=>{
 const db=await database();try{
 const id=(await db.query("insert into events(title,slug,start_at,status,verified,is_manual_entry)values('Together','together','2099-12-25','pending',false,true)returning id")).rows[0].id;
 const cid=(await db.query("insert into categories(name,slug)values('Dining','dining')returning id")).rows[0].id;
 await db.query('insert into event_categories(event_id,category_id)values($1,$2)',[id,cid]);await db.query('insert into event_owner_access(event_id,token_hash)values($1,$2)',[id,'a'.repeat(64)]);
 const call=(payload=ad,hash='a'.repeat(64))=>db.query('select request_managed_advertising_selection($1,$2,$3) id',[id,hash,payload]);
 await db.exec('set role anon');await assert.rejects(call(),/permission denied/);await db.exec('reset role');
 await assert.rejects(call(ad,'b'.repeat(64)),/beheerlink/);
 await assert.rejects(call({...ad,amountCents:1}),/Ongeldige advertentie/);
 await assert.rejects(call({...ad,details:{...ad.details,placements:['highlight','highlight']}}),/geldige advertentievormen/);
 const rid=(await call()).rows[0].id;assert.equal((await call()).rows[0].id,rid);
 let row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.deepEqual(row.advertising_placements,[]);
 const order=(await db.query('select * from advertising_requests')).rows;assert.equal(order.length,1);assert.equal(order[0].amount_cents,24300);
 await db.query("update advertising_requests set mollie_payment_id='tr_together' where id=$1",[rid]);
 await db.query("select settle_advertising_payment('tr_together','paid')");
 row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(row.promotion_status,'requested');assert.equal(row.advertising_placements.length,3);
 await db.query("update events set status='approved',verified=true where id=$1",[id]);
 row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(row.promotion_status,'active');assert.equal(row.title,'Together');
 assert.equal((await db.query('select count(*)::int n from events')).rows[0].n,1);
 const different={...ad,details:{...ad.details,company:'Changed'}};await assert.rejects(call(different),/al betaald/);
 await assert.rejects(db.query('select upgrade_managed_advertising($1,$2,$3,$4)',[id,'a'.repeat(64),'homepage',{...ad,amountCents:14900,details}]),/lopende advertentieaanvraag/);
 // A combined order occupies a homepage slot too. If that frame is full,
 // none of the selected products may be saved or charged.
 for(let i=0;i<8;i++){
  const other=(await db.query("insert into events(title,slug,start_at,is_directory_entry,status,verified)values($1,$1,null,true,'approved',true)returning id",['slot-'+i])).rows[0].id;
  await db.query("insert into advertising_requests(event_id,placement,details,starts_on,ends_on,months,amount_cents,payment_status)values($1,'homepage','{}','2099-01-31','2099-02-28',1,14900,'paid')",[other]);
 }
 const target=(await db.query("insert into events(title,slug,start_at,is_directory_entry,status,verified)values('Full','full',null,true,'approved',true)returning id")).rows[0].id;
 await db.query('insert into event_owner_access(event_id,token_hash)values($1,$2)',[target,'c'.repeat(64)]);await db.query('insert into event_categories(event_id,category_id)values($1,$2)',[target,cid]);
 await assert.rejects(db.query('select request_managed_advertising_selection($1,$2,$3)',[target,'c'.repeat(64),ad]),/Geen advertentieplek/);
 assert.equal((await db.query('select count(*)::int n from advertising_requests where event_id=$1',[target])).rows[0].n,0);
 await db.query("select settle_advertising_payment('tr_together','refunded')");
 row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.deepEqual(row.advertising_placements,[]);assert.equal(row.promotion_status,'ended');
 }finally{await db.close();}
});
test('Bold listings lead results while expired, future and unpaid highlights keep their original order',()=>{
 const now=new Date('2026-11-01T12:00:00Z');const active={promotion_type:'highlight',promotion_status:'active',promotion_start_at:'2026-10-01',promotion_end_at:'2026-12-01'};
 const events=[{id:'near',start_at:'2026-12-01'},{id:'expired',start_at:'2026-12-01',...active,promotion_end_at:'2026-10-01'},{id:'bold-1',start_at:'2026-12-01',...active},{id:'pending',start_at:'2026-12-01',...active,promotion_status:'requested'},{id:'bold-2',start_at:'2026-12-01',promotion_status:'active',advertising_placements:[{placement:'highlight',starts_at:'2026-10-01',ends_at:'2026-12-01'}]}];
 assert.deepEqual(prioritizeHighlighted(events,now).map(e=>e.id),['bold-1','bold-2','near','expired','pending']);assert.equal(events[0].id,'near');
});
test('Combined checkout creates exactly one Mollie payment for the server-stored total and checks all slots',async()=>{
 const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/mollie/checkout/route.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
 const order={id:'order',event_id:'owned',placement:'category',details:ad.details,starts_on:'2099-01-31',ends_on:'2099-02-28',months:1,amount_cents:24300,payment_status:'requested',checkout_key:'stable-key'};
 const capacities=[],payments=[];let fail=false;
 const query={select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle:async()=>({data:order}),update(){return this},then(resolve){resolve({error:null})}};
 const client={from:()=>query,rpc:async(_,args)=>{capacities.push(args.p_placement);return {error:fail&&args.p_placement==='homepage'?{message:'Geen advertentieplek'}:null}}};
 const mollie=async(path,options)=>{payments.push(JSON.parse(options.body));return {id:'tr_combined',_links:{checkout:{href:'https://www.mollie.com/checkout/test'}}}};
 const POST=new Function('managedAccess','mollieRequest','verifiedPaymentState','advertisingOrderTypes','ADVERTISING_LABELS',source+';return POST;')(async()=>client,mollie,()=>{},advertisingOrderTypes,ADVERTISING_LABELS);
 const prior=process.env.MOLLIE_API_KEY;process.env.MOLLIE_API_KEY='test_fixture';
 const request=()=>new Request('https://site.invalid/api/mollie/checkout',{method:'POST',headers:{origin:'https://site.invalid'},body:JSON.stringify({eventId:'owned',requestId:'order',amountCents:1})});
 try{const response=await POST(request());assert.equal(response.status,200);assert.equal(payments.length,1);assert.equal(payments[0].amount.value,'243.00');assert.deepEqual(capacities,['category','highlight','homepage']);assert.equal(payments[0].metadata.requestId,'order');fail=true;assert.equal((await POST(request())).status,409);assert.equal(payments.length,1);}
 finally{if(prior===undefined)delete process.env.MOLLIE_API_KEY;else process.env.MOLLIE_API_KEY=prior;}
});
test('Combined upgrade endpoint uses one order and calculates its total on the server',async()=>{
 const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/managed-event/advertising/route.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');let saved;
 const query={select(){return this},eq(){return this},single:async()=>({data:{id:'combined',amount_cents:24300,details:ad.details}})};
 const client={from:()=>query,rpc:async(name,args)=>{assert.equal(name,'request_managed_advertising_selection');saved=args;return {data:'combined'}}};
 const POST=new Function('managedAccess','tokenHash','validateAdvertiser','advertisingSelectionQuote',source+';return POST;')(async()=>client,()=> 'a'.repeat(64),validateAdvertiser,advertisingSelectionQuote);
 const response=await POST(new Request('https://site.invalid/api/managed-event/advertising',{method:'POST',headers:{origin:'https://site.invalid',authorization:'Bearer test'},body:JSON.stringify({eventId:'owned',placements:selected,advertiser:details,amountCents:1})}));
 assert.equal(response.status,200);assert.equal(saved.p_ad.amountCents,24300);assert.deepEqual(saved.p_ad.details.placements,['category','highlight','homepage']);
});
