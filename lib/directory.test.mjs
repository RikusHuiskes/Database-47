import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Directory migration imports pending linked records without invented dates; repeat imports preserve edits',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table categories(id uuid primary key default gen_random_uuid(),name text,slug text unique,sort_order int,active boolean);
   create table events(id uuid primary key default gen_random_uuid(),title text,slug text unique,short_description text,description text,start_at timestamptz not null,end_at timestamptz,address text,postcode text,city text,latitude numeric,longitude numeric,website_url text,source_url text,contact_phone text,image_url text,status text,verified boolean,source_category text,is_free boolean);
   create table event_categories(event_id uuid references events(id) on delete cascade,category_id uuid references categories(id),primary key(event_id,category_id));`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261028153003_directory_entries.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261031121944_expanded_sirtaqui_directory_categories.sql',import.meta.url),'utf8'));
  await db.exec("insert into categories(name,slug,active) values('Restaurants','restaurants-gastronomie',true),('Sport','sport',true),('Culture','culture-musees',true),('Nature','nature-randonnee',true),('Ateliers','ateliers-cours',true),('Famille','enfants-famille',true)");
  const entry={source_id:'HOTAQU001',category_slug:'hotels-chambres-hotes-gites',title:'Test hotel',city:'Duras',source_url:'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-hotels.csv#HOTAQU001',latitude:44.67,longitude:0.20};
  const run=async(items)=>(await db.query('select public.import_directory_entries($1::jsonb) as r',[JSON.stringify(items)])).rows[0].r;
  await db.exec('set role authenticated');
  await assert.rejects(run([entry]),/permission denied/);
  await db.exec('reset role;set role service_role');
  assert.deepEqual(await run([entry]),{inserted:1,skipped:0});
  await db.exec('reset role');
  await db.exec("update events set title='Bewerkt',status='approved',verified=true");
  assert.deepEqual(await run([entry]),{inserted:0,skipped:1});
  const row=(await db.query('select * from events')).rows[0];
  assert.equal(row.title,'Bewerkt');assert.equal(row.status,'approved');assert.equal(row.start_at,null);assert.equal(row.end_at,null);
  assert.equal((await db.query('select count(*)::int as n from event_categories')).rows[0].n,1);
  await db.exec("delete from events where (coalesce(end_at,start_at) at time zone 'Europe/Paris')::date < current_date");
  assert.equal((await db.query('select count(*)::int as n from events')).rows[0].n,1);
  await assert.rejects(run([{...entry,source_id:'other',source_url:'https://evil.example/data'}]),/Ongeldige/);
  for(const category of ['restaurants-gastronomie','sport','culture-musees','nature-randonnee','ateliers-cours','enfants-famille']){
   const extra={...entry,source_id:category,title:category,category_slug:category,source_url:'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-points-restauration.csv#'+category};
   assert.deepEqual(await run([extra]),{inserted:1,skipped:0});
   assert.deepEqual(await run([extra]),{inserted:0,skipped:1});
  }
  await assert.rejects(db.query("insert into events(title,slug,start_at) values('undated','undated',null)"),/check constraint/);
 }finally{await db.close();}
});
