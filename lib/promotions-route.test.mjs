import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {promotionPlacements} from './event-presentation.ts';
function setup(rows,error=null){
 const calls=[],filters=[];
 const query={select(value){calls.push(['select',value]);return this;},eq(key,value){filters.push([key,value]);return this;},or(value){calls.push(['or',value]);return this;},order(){return this;},async limit(n){calls.push(['limit',n]);return {data:rows.filter(row=>filters.every(([key,value])=>key==='event_categories.category_id'?row.event_categories.some(link=>link.category_id===value):row[key]===value)),error};}};
 const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/promotions/route.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 const GET=new Function('NextResponse','createClient','promotionPlacements',source+';return GET;')(Response,()=>({from(table){assert.equal(table,'events');return query;}}),promotionPlacements);
 return {calls,GET:category=>GET({nextUrl:new URL('https://example.invalid/?category='+category)})};
}
async function configured(run){const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'],old=keys.map(key=>process.env[key]);try{process.env[keys[0]]='https://example.invalid';process.env[keys[1]]='public-test';await run();}finally{keys.forEach((key,i)=>{if(old[i]===undefined)delete process.env[key];else process.env[key]=old[i];});}}
const hotel='0ec36949-0f0a-449a-bd4e-5fddfc7f3148';
const house={id:'house',title:'Gite',start_at:null,status:'approved',verified:true,reserved_homepage:true,reserved_category_id:hotel,event_categories:[{category_id:hotel}]};
test('Small advertising query returns reserved property first and eight paid partners without ordinary search',()=>configured(async()=>{
 const rows=[...Array.from({length:10},(_,i)=>({...house,id:'paid'+i,reserved_homepage:false,reserved_category_id:null,promotion_type:'homepage',promotion_status:'active'})),{...house,id:'private',status:'pending'},house];
 const f=setup(rows),response=await f.GET('all'),result=await response.json();
 assert.equal(response.status,200);assert.equal(result.homepage_promotions.length,9);assert.equal(result.homepage_promotions[0].id,'house');assert(!result.homepage_promotions.some(row=>row.id==='private'));
 assert.equal(f.calls.filter(([name])=>name==='select').length,1);assert.match(f.calls.find(([name])=>name==='or')[1],/promotion_end_at.gt/);assert(!f.calls.some(call=>String(call).includes('latitude')));
}));
test('Category advertising preserves reserved place and excludes inactive and other-category partners',()=>configured(async()=>{
 const rows=[house,...['active','ended','requested'].map(status=>({...house,id:status,reserved_homepage:false,reserved_category_id:null,promotion_type:'category',promotion_status:status})),{...house,id:'other',reserved_homepage:false,reserved_category_id:null,promotion_type:'category',promotion_status:'active',event_categories:[{category_id:crypto.randomUUID()}]}];
 const result=await(await setup(rows).GET(hotel)).json();assert.deepEqual(result.category_promotions.map(row=>row.id),['house','active']);
}));
test('Advertising rejects invalid category and reports database failure',()=>configured(async()=>{
 assert.equal((await setup([]).GET('bad')).status,400);assert.equal((await setup([],{message:'private failure'}).GET('all')).status,502);
}));
