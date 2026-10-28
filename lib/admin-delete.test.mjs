import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Admin delete policy removes pending imports and category links; ordinary users cannot delete', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create table public.events(id uuid primary key, status text, source_url text);
      create table public.event_categories(event_id uuid references public.events(id) on delete cascade, category_id uuid);
      create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
      alter table public.events enable row level security;
      grant select,delete on public.events to authenticated;
      create policy "Admins can read all events" on public.events for select to authenticated using ((select public.is_admin()));
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261028151732_admin_delete_events.sql',import.meta.url),'utf8'));
    const id = crypto.randomUUID();
    await db.query('insert into public.events values($1,$2,$3)', [id,'pending','https://www.tourismeduras.com/test-import']);
    await db.query('insert into public.event_categories values($1,$2)',[id,crypto.randomUUID()]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('delete from public.events where id=$1 returning id',[id])).rows.length,0);
    await db.exec("reset role; set test.admin='true'; set role authenticated;");
    assert.equal((await db.query('delete from public.events where id=$1 returning id',[id])).rows.length,1);
    assert.equal((await db.query('delete from public.events where id=$1 returning id',[id])).rows.length,0);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from public.event_categories')).rows[0].n,0);
  } finally { await db.close(); }
});
