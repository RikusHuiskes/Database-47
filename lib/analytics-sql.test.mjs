import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Actual PostgreSQL migration enforces access, deduplication, accurate reports and retention in an isolated database',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table public.events(id uuid primary key,title text,status text,verified boolean);
      create table public.categories(id uuid primary key,name text);
      create table public.event_categories(event_id uuid,category_id uuid);
      create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/202610280001_analytics.sql',import.meta.url),'utf8'));
    const grants=(await db.query(`select has_table_privilege('anon','public.site_analytics','SELECT') as can_read,
      has_function_privilege('anon','public.record_site_analytics(jsonb)','EXECUTE') as can_write,
      has_function_privilege('authenticated','public.site_analytics_report(integer)','EXECUTE') as can_report`)).rows[0];
    assert.deepEqual(grants,{can_read:false,can_write:false,can_report:true});
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.site_analytics_report(30)'),/Alleen beheerders/);
    await db.exec('reset role');
    const eventId=crypto.randomUUID(),categoryId=crypto.randomUUID(),visitorId=crypto.randomUUID(),sessionId=crypto.randomUUID();
    await db.query("insert into public.events values($1,'Concert','approved',true)",[eventId]);
    await db.query("insert into public.categories values($1,'Muziek')",[categoryId]);
    await db.query('insert into public.event_categories values($1,$2)',[eventId,categoryId]);
    const send=async(action,extra={})=>db.query('select public.record_site_analytics($1::jsonb)',[JSON.stringify({id:crypto.randomUUID(),visitorId,sessionId,consentAt:new Date().toISOString(),action,...extra})]);
    await send('visit');await send('visit');
    await send('category_view',{categoryId});await send('place_view',{area:'Duras'});
    await send('impression',{eventId});await send('impression',{eventId});
    await send('event_view',{eventId});await send('outbound',{eventId,channel:'booking'});
    assert.equal((await db.query('select count(*)::int as n from public.site_analytics')).rows[0].n,6);
    await send('event_view',{eventId:crypto.randomUUID()});
    assert.equal((await db.query('select count(*)::int as n from public.site_analytics')).rows[0].n,6);
    await send('page_view',{page:'/'});await send('page_view',{page:'/'});
    await send('filter_view',{area:'Duras',categoryId,radius:'25'});
    await send('filter_view',{radius:'999'});await send('page_view',{page:'/private?email=secret'});
    assert.equal((await db.query('select count(*)::int as n from public.site_analytics')).rows[0].n,9);
    await db.exec("set test.admin='true';set role authenticated;");
    const report=(await db.query('select public.site_analytics_report(30) as report')).rows[0].report;
    assert.deepEqual(report.summary,{visitors:1,visits:1,pageviews:2,views:1,impressions:1,clicks:1});
    assert.equal(report.monthly[0].pageviews,2);assert.equal(report.monthly[0].visits,1);
    assert.deepEqual(report.pages,[{name:'/',views:2,visitors:1}]);
    assert.deepEqual(report.filters,[{area:'Duras',category:'Muziek',radius_km:25,uses:1}]);
    assert.equal(report.categories[0].visitors,1);assert.equal(report.categories[0].views,1);
    assert.equal(report.events[0].reached_sessions,1);assert.equal(report.events[0].clicked_sessions,1);assert.equal(report.events[0].bookings,1);
    assert.equal(report.places[0].name,'Duras');
    await db.exec("reset role;update public.site_analytics set created_at=now()-interval '14 months';select public.prune_site_analytics();");
    assert.equal((await db.query('select count(*)::int as n from public.site_analytics')).rows[0].n,0);
  }finally{await db.close();}
});
