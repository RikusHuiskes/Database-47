import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
registerHooks({
 resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return {url:url.href,shortCircuit:true};}throw error;}},
 load(url,context,next){if(url.endsWith('/lib/admin-service.ts'))return {format:'module',source:"export async function adminService(request){return request.headers.get('authorization')==='Bearer admin-test'?globalThis.municipalTestClient:null;}",shortCircuit:true};if(url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};return next(url,context);}
});
const {municipalAdminCatalog,municipalAdminResults}=await import('./municipal-admin-catalog.ts');
const {MUNICIPAL_BUSINESS_LABELS}=await import('./municipal-shops.ts');
const catalog=municipalAdminCatalog();
test('Admin includes public businesses beyond the few registered estate agents and hairdressers',()=>{
 assert.ok(catalog.length>100);assert.equal(new Set(catalog.map(item=>item.municipal_key)).size,catalog.length);
 for(const type of ['bakery','butcher','florist','fashion','estate_agent','hairdresser'])assert.ok(catalog.some(item=>item.municipal_type===type),type);
 for(const item of catalog){assert.ok(MUNICIPAL_BUSINESS_LABELS[item.municipal_type]);assert.match(item.municipal_code,/^\d{5}$/);assert.ok(item.title);}
});
test('Saved business data replaces the source row without duplicates; filters precede pagination',()=>{
 const source=catalog.find(item=>item.municipal_type==='bakery');
 const saved={...source,id:'saved-id',title:'Adjusted bakery',promotion_status:'active'};
 const result=municipalAdminResults(catalog,[saved],source.municipal_code,'bakery',1);
 assert.ok(result.items.some(item=>item.id==='saved-id'&&item.title==='Adjusted bakery'));
 assert.equal(result.items.filter(item=>item.municipal_key===source.municipal_key).length,1);
 assert.ok(result.items.every(item=>item.municipal_code===source.municipal_code&&item.municipal_type==='bakery'));
 assert.equal(municipalAdminResults(catalog,[],'','',1).items.length,25);
 const pages=Array.from({length:Math.ceil(catalog.length/25)},(_,i)=>municipalAdminResults(catalog,[],'','',i+1).items).flat();assert.equal(pages.length,catalog.length);
 assert.equal(municipalAdminResults(catalog,[],'99999','bakery',1).total,0);
});

const {GET,POST}=await import('../app/api/admin/municipal-listings/route.ts');
test('Admin endpoint denies anonymous reads and writes and rejects foreign-origin saves',async()=>{
 assert.equal((await GET(new Request('https://site.test/api/admin/municipal-listings'))).status,403);
 assert.equal((await POST(new Request('https://site.test/api/admin/municipal-listings',{method:'POST',headers:{Origin:'https://site.test'},body:'{}'}))).status,403);
 assert.equal((await POST(new Request('https://site.test/api/admin/municipal-listings',{method:'POST',headers:{Origin:'https://foreign.test',Authorization:'Bearer admin-test'},body:'{}'}))).status,403);
});
test('Authenticated catalog request returns real bakery results and rejects unsupported rubrics',async()=>{
 globalThis.municipalTestClient={from:()=>({select:()=>({not:()=>({order:()=>({range:async()=>({data:[],error:null})})})})})};
 const response=await GET(new Request('https://site.test/api/admin/municipal-listings?type=bakery',{headers:{Authorization:'Bearer admin-test'}}));
 assert.equal(response.status,200);const data=await response.json();assert.ok(data.total>0);assert.ok(data.items.every(item=>item.municipal_type==='bakery'));
 assert.equal((await GET(new Request('https://site.test/api/admin/municipal-listings?type=invalid',{headers:{Authorization:'Bearer admin-test'}}))).status,400);
});
test('Saving a source listing validates its identity and applies only editable business fields',async()=>{
 let saved,registration;
 const id='11111111-1111-4111-8111-111111111111';
 globalThis.municipalTestClient={rpc:async(name,args)=>{registration=args;return {data:id,error:null};},from:()=>({update:patch=>{saved=patch;return {eq:()=>({not:()=>({select:()=>({single:async()=>({data:{id},error:null})})})})};}})};
 const source=catalog.find(item=>item.municipal_type==='bakery');
 const request=body=>new Request('https://site.test/api/admin/municipal-listings',{method:'POST',headers:{Origin:'https://site.test',Authorization:'Bearer admin-test'},body:JSON.stringify(body)});
 const response=await POST(request({...source,title:'Updated bakery',promotion_status:'active',verified:false}));assert.equal(response.status,200);assert.equal((await response.json()).id,id);
 assert.equal(saved.title,'Updated bakery');assert.equal(saved.promotion_status,undefined);assert.equal(saved.verified,undefined);assert.equal(registration.p_listing.key,source.municipal_key);
 assert.equal((await POST(request({...source,id:'catalog:unknown'}))).status,400);
 delete globalThis.municipalTestClient;
});
