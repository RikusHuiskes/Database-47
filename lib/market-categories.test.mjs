import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Market correction preserves records, photos, manual classifications and specific meals',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create table events(id int primary key,start_at timestamptz,source_url text,is_manual_entry boolean,image_url text,status text);
      create table categories(id int primary key,slug text);
      create table event_categories(event_id int references events(id),category_id int references categories(id),primary key(event_id,category_id));
      insert into categories values(1,'restaurants-gastronomie'),(2,'marches-brocantes');
      insert into events values(1,null,'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-47.csv#market',false,'photo','approved'),(2,null,'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-47.csv#manual',true,'manual-photo','pending'),(3,null,'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-47.csv#meal',false,'meal-photo','approved'),(4,null,'https://other.example/market',false,'other-photo','approved');
      insert into event_categories values(1,1),(1,2),(2,1),(2,2),(3,1),(4,1),(4,2);`);
    const before=(await db.query('select * from events order by id')).rows;
    const sql=readFileSync(new URL('../supabase/migrations/20261029082920_event_search_performance_and_market_categories.sql',import.meta.url),'utf8');
    await db.exec(sql);await db.exec(sql);
    assert.deepEqual((await db.query('select * from events order by id')).rows,before);
    assert.deepEqual((await db.query('select * from event_categories order by event_id,category_id')).rows,[{event_id:1,category_id:2},{event_id:2,category_id:1},{event_id:2,category_id:2},{event_id:3,category_id:1},{event_id:4,category_id:1},{event_id:4,category_id:2}]);
  }finally{await db.close();}
});
