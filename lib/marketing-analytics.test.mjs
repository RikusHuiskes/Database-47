import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {analyticsCsv} from './analytics-report.ts';
import {normalizeAcquisition,campaignUrl} from './marketing-attribution.ts';

test('acquisition keeps campaign tags, strips private URLs and trusts server country',()=>{
 const value=normalizeAcquisition({source:'Instagram',medium:'paid_social',campaign:'Winter-2026',content:'market-photo',referrer:'instagram.com',landing:'/adverteren?email=secret',country:'US',email:'secret',language:'fr'},'FR','iPhone Mobile');
 assert.equal(value.country,'FR');assert.equal(value.channel,'paid_social');assert.equal(value.campaign,'winter-2026');assert.equal(value.device,'mobile');assert.equal(value.landing,'/');assert.equal(value.email,undefined);
 const privateData=normalizeAcquisition({source:'someone@example.com',referrer:'https://facebook.com/private?email=secret'},null,'');
 assert.equal(privateData.source,'');assert.equal(privateData.referrer,'');assert.equal(privateData.country,'');
 assert.equal(normalizeAcquisition(null,'NL','Browser'),null);
});
test('campaign links preserve destination anchors, encode tags and reject foreign sites',()=>{
 const url=new URL(campaignUrl('https://www.cotededuras.com/#gemeenten','Facebook','social','Winter 2026','Market photo'));
 assert.equal(url.hash,'#gemeenten');assert.equal(url.searchParams.get('utm_source'),'facebook');assert.equal(url.searchParams.get('utm_campaign'),'winter 2026');
 assert.throws(()=>campaignUrl('https://other.example','fb','social','winter'));
 assert.throws(()=>campaignUrl('https://www.cotededuras.com/mijn-vermelding','fb','social','winter'));
 assert.throws(()=>campaignUrl('https://www.cotededuras.com/','fb','social',''));
});

test('marketing report attributes whole sessions without inventing legacy sources or purchases',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table public.events(id uuid primary key,title text,status text,verified boolean);
    create table public.categories(id uuid primary key,name text);
    create table public.event_categories(event_id uuid,category_id uuid);
    create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;`);
  for(const p of ['202610280001_analytics.sql','20261115211621_marketing_analytics_dashboard.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+p,import.meta.url),'utf8'));
  await assert.rejects(db.query('select public.site_marketing_report(30)'),/Alleen beheerders/);
  const eventId=crypto.randomUUID();await db.query("insert into public.events values($1,'Market','approved',true)",[eventId]);
  const visitor=crypto.randomUUID(),session=crypto.randomUUID();
  const send=(action,extra={},sid=session)=>db.query('select public.record_site_analytics($1::jsonb)',[JSON.stringify({id:crypto.randomUUID(),visitorId:visitor,sessionId:sid,consentAt:new Date().toISOString(),action,...extra})]);
  const acquisition={source:'facebook',medium:'social',campaign:'winter',content:'market',channel:'organic_social',country:'FR',landing:'/',language:'fr',device:'mobile'};
  await send('visit',{acquisition});await send('visit',{acquisition:{...acquisition,source:'wrong-duplicate'}});
  await send('event_view',{eventId});await send('outbound',{eventId,channel:'booking'});await send('checkout_start');await send('filter_view',{radius:'5'});
  await send('visit',{},crypto.randomUUID());
  await db.exec("set test.admin='true'");
  const report=(await db.query('select public.site_marketing_report(30) report')).rows[0].report;
  assert.equal(report.summary.visits,2);assert.equal(report.summary.visitors,1);assert.equal(report.summary.attributed,1);assert.equal(report.summary.engaged,1);assert.equal(report.summary.bookings,1);assert.equal(report.summary.checkouts,1);
  const csv=analyticsCsv({marketing:report,generatedAt:new Date().toISOString(),firstMeasuredAt:null,totalMeasuredVisitors:1,summary:{visitors:1,visits:2,pageviews:0,views:1,impressions:0,clicks:1},monthly:[],daily:[],pages:[],filters:[],places:[],categories:[],events:[]},30);assert.match(csv,/facebook \/ social \/ winter/);assert.match(csv,/Landen/);
  assert.equal(report.campaigns[0].name,'facebook / social / winter');assert.equal(report.campaigns[0].bookings,1);
  assert(report.channels.some(r=>r.name==='unmeasured'&&r.visits===1));assert.equal(report.countries.find(r=>r.name==='FR').visits,1);
  assert.equal((await db.query("select count(*)::int n from public.site_analytics where action='filter_view' and radius_km=5")).rows[0].n,1);
  assert.equal((await db.query("select has_function_privilege('anon','public.site_marketing_report(integer)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(db.query('select public.site_marketing_report(500)'),/Ongeldige periode/);
  // Previous-period comparison is distinct from current source assignment.
  await db.query("update public.site_analytics set created_at=now()-interval '40 days' where session_id=$1",[session]);
  const compared=(await db.query('select public.site_marketing_report(30) report')).rows[0].report;
  assert.equal(compared.summary.visits,1);assert.equal(compared.previous.visits,1);assert.equal(compared.previous.bookings,1);assert.equal(compared.returningVisitors,1);
 }finally{await db.close()}
});
