import {promotionPlacements} from './event-presentation.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

function route(rows,links=[]) {
  const query={reservedKey:null,reservedValue:null,select(){return this},eq(key,value){if(key.startsWith('reserved_')){this.reservedKey=key;this.reservedValue=value;}return this},limit:async()=>({data:rows.filter(row=>query.reservedKey&&row[query.reservedKey]===query.reservedValue).map(row=>({...row,event_categories:links.filter(link=>link.event_id===row.id).map(link=>({category_id:link.category_id}))})),error:null}),or(){return this},order(){return this},range:async(start,end)=>({data:rows.slice(start,end+1).map(row=>({...row,event_categories:links.filter(link=>link.event_id===row.id).map(link=>({category_id:link.category_id}))})),error:null})};
  const client={from:()=>query};
  const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/nearby-events/route.ts',import.meta.url),'utf8'))
    .replace(/^import \{([^}]+)\} from "([^"]+)";/gm,(_,names,path)=>`const {${names}}=require(${JSON.stringify(path)});`)
    .replace(/export /g,'')+'\nexports.GET=GET;';
  const exports={};
  new Function('require','exports',source)(name=>{
    if(name==='next/server')return {NextResponse:Response};
    if(name==='@supabase/supabase-js')return {createClient:()=>client};
    if(name.includes('event-presentation'))return {promotionPlacements,promotionIsActive:event=>event.promotion_status==='active',uniqueEventRecords:rows=>[...new Map(rows.map((row,index)=>[row.id??index,row])).values()]};
    if(name.includes('commune-center'))return {savedCommuneCenter:()=>null};
    if(name.includes('local-area'))return {normalizePlaceName:x=>x,distanceInKm:(lat,lon,x,y)=>Math.hypot(lat-x,lon-y)*111};
    throw Error(name);
  },exports);
  return params=>exports.GET({nextUrl:new URL(`https://example.com/?${params}`)});
}

test('Nearby route rejects missing coordinates',async()=>{
  assert.equal((await route([])('radius=25')).status,400);
});

test('The reserved property remains first outside the search radius and appears only in its own category',async()=>{
 const previous=[process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY];
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.com';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test';
 try{
  const hotel=crypto.randomUUID(),music=crypto.randomUUID();
  const house={id:'reserved',title:'Gîte',latitude:45,longitude:0,start_at:null,is_directory_entry:true,reserved_homepage:true,reserved_category_id:hotel};
  const rows=[house,...Array.from({length:12},(_,i)=>({id:'paid-'+i,title:'Partner',latitude:44,longitude:0,start_at:null,is_directory_entry:true,promotion_type:'homepage',promotion_status:'active'}))];
  const get=route(rows,[{event_id:'reserved',category_id:hotel}]);
  const home=await(await get('lat=44&lon=0&radius=10')).json();assert.equal(home.homepage_promotions[0].id,'reserved');assert.equal(home.homepage_promotions.length,9);assert(!home.events.some(e=>e.id==='reserved'));
  const hotels=await(await get(`lat=44&lon=0&radius=10&category=${hotel}`)).json();assert.equal(hotels.category_promotions[0].id,'reserved');
  const other=await(await get(`lat=44&lon=0&radius=10&category=${music}`)).json();assert.equal(other.category_promotions.length,0);
 }finally{for(const [i,key] of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'].entries()){if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];}}
});

test('Category membership AND distance apply to events, permanent listings and promotions; all preserves unlinked events',async()=>{
  const previous=[process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY];
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.com';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test';
  try{
    const hotel=crypto.randomUUID(),music=crypto.randomUUID();
    const rows=[
      {id:'directory',title:'Hotel',latitude:44,longitude:0,start_at:null,is_directory_entry:true,promotion_type:'category',promotion_status:'active'},
      {id:'music',title:'Hotel concert',latitude:44,longitude:0,start_at:'2099-01-01',promotion_type:'homepage',promotion_status:'active'},
      {id:'multi',title:'Multiple linked categories',latitude:44,longitude:0,start_at:'2099-01-01'},
      {id:'far',title:'Far hotel',latitude:45,longitude:0,start_at:null,is_directory_entry:true},
      {id:'past',title:'Past hotel event',latitude:44,longitude:0,start_at:'2000-01-01'},
      {id:'none',title:'Hotel without category',category_id:hotel,latitude:44,longitude:0,start_at:'2099-01-01'}
    ];
    const links=[['directory',hotel],['music',music],['multi',music],['multi',hotel],['far',hotel],['past',hotel]].map(([event_id,category_id])=>({event_id,category_id}));
    const get=route(rows,links);
    const result=await(await get(`lat=44&lon=0&radius=10&category=${hotel}`)).json();
    assert.deepEqual(result.events.map(e=>e.id).sort(),['directory','multi']);
    assert.deepEqual(result.homepage_promotions,[]);
    assert.deepEqual(result.category_promotions.map(e=>e.id),['directory']);
    const all=await(await get('lat=44&lon=0&radius=10&category=all')).json();
    assert.deepEqual(all.events.map(e=>e.id).sort(),['directory','multi','music','none']);
    assert.equal((await get('lat=44&lon=0&category=invalid')).status,400);
  }finally{
    for(const [i,key] of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'].entries()){
      if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];
    }
  }
});

test('Promotions obey the same radius and upcoming filter as ordinary events',async()=>{
  const previous=[process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY];
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.com';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test';
  try {
    const rows=[
      {title:'near',latitude:44,longitude:0,start_at:'2099-01-01',promotion_type:'homepage',promotion_status:'active'},
      {title:'far',latitude:45,longitude:0,start_at:'2099-01-01',promotion_type:'category',promotion_status:'active'},
      {title:'past',latitude:44,longitude:0,start_at:'2000-01-01',promotion_type:'homepage',promotion_status:'active'},
    ];
    const result=await (await route(rows)('lat=44&lon=0&radius=10')).json();
    assert.deepEqual(result.events.map(x=>x.title),['near']);
    assert.deepEqual(result.homepage_promotions.map(x=>x.title),['near']);
    assert.deepEqual(result.category_promotions,[]);
  } finally {
    for(const [index,key] of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'].entries()) {
      if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];
    }
  }
});
