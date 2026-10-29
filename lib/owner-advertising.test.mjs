import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {advertisingQuote,validateAdvertiser,emptyAdvertiser} from './advertising.ts';
import {promotionIsActive} from './event-presentation.ts';
import {verifiedPaymentState,mollieRequest} from './mollie.ts';
import {isWineTasting} from './wine-category.ts';
import {sirtaquiCategories} from './sirtaqui.ts';
import {alphabeticalPlaces} from './place-order.ts';
import {visitorEventInput} from './visitor-event-input.ts';

test('Monthly prices and calendar periods include leap days and month ends',()=>{
 assert.deepEqual(advertisingQuote('homepage',{...emptyAdvertiser,startDate:'2027-01-31',months:1}),{amountCents:14900,startDate:'2027-01-31',endDate:'2027-02-28',months:1});
 assert.equal(advertisingQuote('category',{...emptyAdvertiser,startDate:'2028-01-31',months:1}).endDate,'2028-02-29');
 assert.equal(advertisingQuote('highlight',{...emptyAdvertiser,startDate:'2027-01-01',months:3}).amountCents,4500);
 assert.throws(()=>advertisingQuote('none',emptyAdvertiser));assert.throws(()=>advertisingQuote('homepage',{...emptyAdvertiser,startDate:'2027-02-30'}));
 assert.throws(()=>validateAdvertiser('homepage',{...emptyAdvertiser,startDate:'2027-01-01'}));
});
test('Advertisements are hidden before the start and from the exclusive end onward',()=>{
 const event={promotion_status:'active',promotion_start_at:'2027-01-01T00:00:00Z',promotion_end_at:'2027-02-01T00:00:00Z'};
 assert.equal(promotionIsActive(event,new Date('2026-12-31T23:59:59Z')),false);
 assert.equal(promotionIsActive(event,new Date('2027-01-01T00:00:00Z')),true);
 assert.equal(promotionIsActive(event,new Date('2027-02-01T00:00:00Z')),false);
 assert.equal(promotionIsActive({...event,promotion_status:'requested'},new Date('2027-01-02')),false);
});
test('Wine tastings route to wineries; a chocolate or cheese tasting stays gastronomic',()=>{
 assert(isWineTasting({title:'Visite & dégustation',description:'Découvrez le vignoble et dégustez nos vins.'}));
 assert(!isWineTasting({title:'Dégustation de chocolat',description:'Chocolat artisanal et pralines.'}));
 assert.deepEqual(sirtaquiCategories({NOM_OFFRE:'Dégustation au château',CATEGORIE:'Dégustation',TYPE:'Animation',THEME:'Gastronomie',DESCRIPTIF:'Visite du chai et dégustation de nos vins.'}),['wijnhuizen']);
 assert(sirtaquiCategories({NOM_OFFRE:'Dégustation de fromages',CATEGORIE:'Dégustation',TYPE:'Repas',THEME:'Gastronomie'}).includes('restaurants-gastronomie'));
});
test('All supported languages sort place names alphabetically without changing their identity',()=>{
 const places=[{name:'Saint-Émilion',id:1},{name:'Duras',id:2},{name:'Éymet',id:3},{name:'Agen',id:4}];
 for(const locale of ['nl','en','fr'])assert.deepEqual(alphabeticalPlaces(places,locale).map(p=>p.id),[4,2,3,1]);
 assert.equal(places[0].id,1);
});
test('Server validates public fields and excludes approval/payment/identity injection',()=>{
 const event=visitorEventInput({title:'Gîte',city:'Duras',is_directory_entry:true,website_url:'www.example.fr',booking_url:'www.example.fr',source_url:'www.example.fr',status:'approved',verified:true,owner_id:'fake',promotion_type:'none'});
 assert.equal(event.website_url,'https://www.example.fr/');assert.equal(event.status,undefined);assert.equal(event.owner_id,undefined);assert.equal(event.start_at,null);
 assert.throws(()=>visitorEventInput({...event,is_directory_entry:false,start_at:null}));
});
test('Mollie amount, identity and refunds must match server-side order; no live keys in preview',async()=>{
 const order={id:'order-1',amount_cents:14900},payment={status:'paid',metadata:{requestId:'order-1'},amount:{currency:'EUR',value:'149.00'}};
 assert.equal(verifiedPaymentState(payment,order),'paid');
 assert.equal(verifiedPaymentState({...payment,amountRefunded:{value:'149.00'}},order),'refunded');
 assert.throws(()=>verifiedPaymentState({...payment,amount:{currency:'EUR',value:'1.00'}},order));
 const prior=process.env.MOLLIE_API_KEY;process.env.MOLLIE_API_KEY='live_test';
 try{await assert.rejects(mollieRequest('payments'),/test-key/);}finally{if(prior===undefined)delete process.env.MOLLIE_API_KEY;else process.env.MOLLIE_API_KEY=prior;}
});

test('Actual ownership/payment SQL keeps secrets private, preserves edits and only activates confirmed payments',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table categories(id uuid primary key default gen_random_uuid(),name text,slug text unique,sort_order int,active boolean);
   create table events(id uuid primary key default gen_random_uuid(),title text,slug text unique,short_description text,description text,start_at timestamptz not null,end_at timestamptz,venue_name text,address text,postcode text,city text,latitude numeric,longitude numeric,website_url text,booking_url text,source_url text,contact_phone text,image_url text,organizer_name text,status text,verified boolean,source_category text,is_free boolean,price_from numeric,price_to numeric,promotion_type text default 'none',promotion_status text default 'none',advertiser_email text,created_at timestamptz default now(),updated_at timestamptz default now());
   create table event_categories(event_id uuid references events(id) on delete cascade,category_id uuid references categories(id),primary key(event_id,category_id));`);
  for(const file of ['202610270002_manual_event_identity.sql','20261028153003_directory_entries.sql','20261029132413_owner_management_and_advertising_preparation.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const category=(await db.query("select id from categories where slug='hotels-chambres-hotes-gites'")).rows[0].id;
  const payload={title:'Mijn gîte',is_directory_entry:true,city:'Duras',website_url:'https://example.fr',booking_url:'https://example.fr/book',source_url:'https://example.fr',promotion_type:'homepage',promotion_status:'active',status:'approved',verified:true,image_url:'photo'};
  const details={...emptyAdvertiser,name:'Test',address:'Teststraat 1',postcode:'47120',city:'Duras',email:'test@example.invalid',phone:'123',startDate:'2027-01-01',months:1};
  const ad={...advertisingQuote('homepage',details),details};
  await db.exec('set role anon');
  await assert.rejects(db.query('select public.submit_managed_event($1,$2,$3,$4)',[payload,category,'a'.repeat(64),ad]),/permission denied/);
  await assert.rejects(db.query('select * from public.event_owner_access'),/permission denied/);
  await assert.rejects(db.query('select * from public.advertising_requests'),/permission denied/);
  await db.exec('reset role;set role service_role');
  const id=(await db.query('select public.submit_managed_event($1,$2,$3,$4) as id',[payload,category,'a'.repeat(64),ad])).rows[0].id;
  await db.exec('reset role');
  let row=(await db.query('select * from events where id=$1',[id])).rows[0];
  assert.equal(row.is_directory_entry,true);assert.equal(row.start_at,null);assert.equal(row.status,'pending');assert.equal(row.verified,false);assert.equal(row.promotion_status,'requested');assert.equal(row.advertiser_email,null);
  await db.query('select public.update_managed_event($1,$2,$3)',[id,{...payload,title:'Bijgewerkt',status:'approved',promotion_status:'active'},category]);
  row=(await db.query('select * from events where id=$1',[id])).rows[0];assert.equal(row.title,'Bijgewerkt');assert.equal(row.status,'pending');assert.equal(row.image_url,'photo');
  await db.query("update advertising_requests set mollie_payment_id='tr_test' where event_id=$1",[id]);
  await db.query("select public.settle_advertising_payment('tr_test','paid')");
  assert.equal((await db.query('select promotion_status from events where id=$1',[id])).rows[0].promotion_status,'requested');
  await db.query("update events set status='approved',verified=true where id=$1",[id]);
  assert.equal((await db.query('select promotion_status from events where id=$1',[id])).rows[0].promotion_status,'active');
  await db.query("select public.settle_advertising_payment('tr_test','refunded')");
  assert.equal((await db.query('select promotion_status from events where id=$1',[id])).rows[0].promotion_status,'ended');
  await assert.rejects(db.query('select public.submit_managed_event($1,$2,$3,$4)',[payload,category,'b'.repeat(64),{...ad,amountCents:1}]),/Ongeldige advertentie/);
  assert.equal((await db.query('select count(*)::int as n from events')).rows[0].n,1);
 }finally{await db.close();}
});
