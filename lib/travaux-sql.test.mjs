import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('travaux migration keeps addresses private and lets only the first three paying providers respond', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261125160000_travaux.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/20261125190000_travaux_public_feed.sql', import.meta.url), 'utf8'));
    const [owner, stranger, ...providers] = Array.from({ length: 6 }, () => crypto.randomUUID());
    for (const id of [owner, stranger, ...providers]) await db.query('insert into auth.users values ($1)', [id]);

    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.travaux_contacts'), /permission denied/);
    await assert.rejects(db.query('select * from public.travaux_public_feed'), /permission denied/);
    await assert.rejects(db.query(`select public.travaux_respond('${stranger}', '${owner}', false, null, null)`), /permission denied/);
    await db.exec('set role service_role');
    const [{ id: job }] = (await db.query('select public.travaux_create($1, $2, $3) as id', [owner,
      { title: 'Taille de haie', description: 'Vingt mètres de haie à entretenir.', category: 'jardin', commune: 'Duras' },
      { name: 'Habitant', address: 'Adresse privée', email: 'resident@example.test', phone: '0553000000' },
    ])).rows;
    const reply = async (provider, testMode = false) => (await db.query(
      'select public.travaux_respond($1, $2, $3, $4, $5) as result', [provider, job, testMode, 'Disponible', 12000],
    )).rows[0].result;
    const pay = (provider, paid, seen = new Date().toISOString()) => db.query(
      "select public.travaux_record_payment($1, $2, (now() at time zone 'Europe/Paris')::date, $3, $4)",
      ['test-payment-' + provider, provider, paid, seen],
    );
    await Promise.all(providers.map(async provider => {
      await db.query(`insert into public.travaux_providers (user_id, name, email, phone, test_mode, subscription_id)
        values ($1, 'Artisan', 'artisan@example.test', '0553000001', false, $2)`, [provider, 'sub-' + provider]);
      await pay(provider, true);
    }));

    const feed = async () => (await db.query('select * from public.travaux_public_feed where id = $1', [job])).rows;
    assert.deepEqual(await feed(), []);
    assert.equal(await reply(providers[0]), 'unavailable');
    await db.query("update public.travaux_jobs set status = 'open' where id = $1", [job]);
    assert.equal((await feed())[0].response_count, 0);
    assert.equal(await reply(owner), 'unavailable');
    assert.equal(await reply(stranger), 'subscription');
    assert.equal(await reply(providers[0], true), 'subscription');
    await pay(providers[0], false, '2099-01-01T00:00:00Z');
    await pay(providers[0], true, '2098-01-01T00:00:00Z');
    assert.equal(await reply(providers[0]), 'subscription');
    await pay(providers[0], true, '2099-01-02T00:00:00Z');

    assert.equal(await reply(providers[0]), 'accepted');
    assert.equal((await feed())[0].response_count, 1);
    const results = await Promise.all(providers.slice(1).map(provider => reply(provider)));
    assert.equal(results.filter(result => result === 'accepted').length, 2);
    assert.equal(results.filter(result => result === 'unavailable').length, 1);
    const accepted = providers[0];
    assert.equal(await reply(accepted), 'already');
    const slots = (await db.query('select slot, quote_cents from public.travaux_responses where job_id = $1 order by slot', [job])).rows;
    assert.deepEqual(slots, [1, 2, 3].map(slot => ({ slot, quote_cents: 12000 })));
    const [full] = await feed();
    assert.equal(full.response_count, 3);
    assert.deepEqual(Object.keys(full).sort(), ['category','commune','created_at','description','id','response_count','title']);
    assert.equal((await db.query('select status from public.travaux_jobs where id = $1', [job])).rows[0].status, 'closed');
  } finally {
    await db.close();
  }
});
