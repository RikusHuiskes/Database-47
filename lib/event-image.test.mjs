import test from 'node:test';
import assert from 'node:assert/strict';
import {eventDisplayImage,EVENT_LOGO_URL,REVIEWED_UNUSABLE_IMAGES} from './event-image.ts';
import {sirtaquiPhotoUrl} from './sirtaqui.ts';

test('Only reviewed bad images are replaced; valid images and new uploads are retained',()=>{
 assert.equal(REVIEWED_UNUSABLE_IMAGES.size,49);
 for(const source of REVIEWED_UNUSABLE_IMAGES)assert.equal(eventDisplayImage(source),EVENT_LOGO_URL);
 for(const source of ['https://example.fr/new-original.jpg','https://example.fr/logo.svg',EVENT_LOGO_URL])assert.equal(eventDisplayImage(source),source);
 for(const source of [null,undefined,'','  ','javascript:alert(1)','data:image/png;base64,abc'])assert.equal(eventDisplayImage(source),EVENT_LOGO_URL);
 assert.equal(sirtaquiPhotoUrl('D74CD9A0-7434-4B34-ACD2-3E4B1088112F/a3-marche-3.jpg'),EVENT_LOGO_URL);
 assert.equal(sirtaquiPhotoUrl(''),null);
});

import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('Database replacement protects imports, leaves directories and good photos intact, and records originals for rollback',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table public.events(id uuid primary key,image_url text,is_directory_entry boolean default false,municipal_key text,updated_at timestamptz);`);
  const bad=[...REVIEWED_UNUSABLE_IMAGES][0],ids=Array.from({length:5},()=>crypto.randomUUID());
  const sources=[bad,null,'https://example.fr/sharp.jpg',bad,bad];
  for(let i=0;i<ids.length;i++)await db.query('insert into public.events(id,image_url,is_directory_entry,municipal_key) values($1,$2,$3,$4)',[ids[i],sources[i],i===3,i===4?'directory':null]);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261113132951_replace_reviewed_event_images.sql',import.meta.url),'utf8'));
  const photos=(await db.query('select id,image_url from public.events')).rows;
  for(let i=0;i<ids.length;i++)assert.equal(photos.find(x=>x.id===ids[i]).image_url,i<2?EVENT_LOGO_URL:sources[i]);
  assert.equal((await db.query('select count(*)::int as n from public.event_image_repair_history')).rows[0].n,2);
  assert.equal((await db.query('select original_url from public.event_image_repair_history where event_id=$1',[ids[0]])).rows[0].original_url,bad);
  await db.query('update public.events set image_url=$1 where id=$2',[bad,ids[0]]);
  assert.equal((await db.query('select image_url from public.events where id=$1',[ids[0]])).rows[0].image_url,EVENT_LOGO_URL);
  await db.query('update public.events set image_url=$1 where id=$2',['https://example.fr/new.jpg',ids[0]]);
  assert.equal((await db.query('select image_url from public.events where id=$1',[ids[0]])).rows[0].image_url,'https://example.fr/new.jpg');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.event_image_repair_history'),/permission denied/);
 }finally{await db.close();}
});
