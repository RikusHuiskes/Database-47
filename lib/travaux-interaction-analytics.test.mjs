import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');

test('Travaux reports consented interactions separately from confirmed activity', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);`);
    await db.exec(migration('20261125160000_travaux.sql'));
    await db.exec(`create table public.site_analytics (
      id uuid primary key, visitor_id uuid, session_id uuid, consent_at timestamptz,
      action text, page_path text, acquisition jsonb, created_at timestamptz not null default now()
    );`);
    await db.exec(migration('20261126164952_travaux_interaction_analytics.sql'));
    const [user, visitor, visit, id] = Array.from({length:4}, () => crypto.randomUUID());
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.travaux_interaction_report(7)'), /permission denied/);
    await assert.rejects(db.query('select public.record_travaux_interaction($1,$2,$3)', [id,visit,'tab_intro']), /permission denied/);
    await db.exec('reset role');
    await db.query('insert into auth.users values ($1)', [user]);
    await db.query(`insert into public.travaux_jobs(owner_id,title,description,category,commune)
      values ($1,'Project','One test project','charpente','Duras')`, [user]);
    await db.query(`insert into public.site_analytics(id,visitor_id,session_id,consent_at,action,page_path,acquisition)
      values (gen_random_uuid(),$1,$2,now(),'visit',null,'{"channel":"organic_search"}'),
      (gen_random_uuid(),$1,$2,now(),'page_view','/travaux',null)`, [visitor,visit]);
    const track = (eventId, kind) => db.query('select public.record_travaux_interaction($1,$2,$3)', [eventId,visit,kind]);
    await track(id, 'tab_intro');
    await track(id, 'tab_intro');
    await track(crypto.randomUUID(), 'tab_intro');
    await assert.rejects(track(crypto.randomUUID(), 'unapproved_gesture'), /check constraint/);
    const {rows:[{report}]}=await db.query('select public.travaux_interaction_report(7) as report');
    assert.deepEqual(report.traffic, {visits:1,visitors:1,pageviews:1});
    assert.deepEqual(report.events.tab_intro, {count:2,visits:1});
    assert.equal(report.daily.length,7);
    assert.equal(report.daily.at(-1).interactions,2);
    assert.equal(report.operations.submitted,1);
    assert.equal(report.operations.paid,0);
    assert.deepEqual(report.categories,[{key:'charpente',count:1}]);
    assert.deepEqual(report.towns,[{key:'Duras',count:1}]);
    assert.deepEqual(report.channels,[{key:'organic_search',count:1}]);
    await db.exec("update public.travaux_interactions set created_at = now() - interval '14 months'");
    await db.exec('select public.prune_site_analytics()');
    const {rows:[{count}]}=await db.query('select count(*)::int as count from public.travaux_interactions');
    assert.equal(count,0);
  } finally { await db.close(); }
});
