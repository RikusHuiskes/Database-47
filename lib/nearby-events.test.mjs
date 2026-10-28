import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

function route(rows) {
  const query={select(){return this},eq(){return this},order(){return this},in:async()=>({data:[],error:null}),range:async()=>({data:rows,error:null})};
  const client={from:()=>query};
  const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/nearby-events/route.ts',import.meta.url),'utf8'))
    .replace(/^import \{([^}]+)\} from "([^"]+)";/gm,(_,names,path)=>`const {${names}}=require(${JSON.stringify(path)});`)
    .replace(/export /g,'')+'\nexports.GET=GET;';
  const exports={};
  new Function('require','exports',source)(name=>{
    if(name==='next/server')return {NextResponse:Response};
    if(name==='@supabase/supabase-js')return {createClient:()=>client};
    if(name.includes('local-area'))return {normalizePlaceName:x=>x,distanceInKm:(lat,lon,x,y)=>Math.hypot(lat-x,lon-y)*111};
    throw Error(name);
  },exports);
  return params=>exports.GET({nextUrl:new URL(`https://example.com/?${params}`)});
}

test('Nearby route rejects missing coordinates',async()=>{
  assert.equal((await route([])('radius=25')).status,400);
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
