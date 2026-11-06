import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/listing-search/route.ts',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'').replace(/\bexport /g,'');
function fixture({rows=[],error=null,services=[]}={}){
 const calls=[];
 const query={};
 for(const method of ['select','eq','is','ilike','order'])query[method]=(...args)=>{calls.push([method,...args]);return query;};
 query.range=async(...args)=>{calls.push(['range',...args]);return {data:rows,error};};
 const deps={createClient:(url,key)=>{calls.push(['client',url,key]);return {from:table=>{calls.push(['from',table]);return query;}};},areas:{areas:[{name:'Duras',code_insee:'47086',latitude:44,longitude:0},{name:'Eymet',code_insee:'24167'}]},municipalCatalog:()=>({services}),COMMERCIAL_SERVICE_TYPES:['bakery','psychologist'],normalizePlaceName:s=>s.toLowerCase(),process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://public.example',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-key'}}};
 return {run:new Function(...Object.keys(deps),source+';return GET;')(...Object.values(deps)),calls};
}
const request=params=>new Request('https://example.invalid/api/listing-search?'+new URLSearchParams(params));
test('Search requires bounded input and never creates access or payments',async()=>{
 for(const params of [{q:'a'},{q:'ok',page:'-1'},{q:'ok',source:'private'},{q:'x'.repeat(121)}]){
  const f=fixture();assert.equal((await f.run(request(params))).status,400);assert.equal(f.calls.length,0);
 }
});
test('Calendar lookup uses anonymous read access, approved public rows and literal filters',async()=>{
 const rows=Array.from({length:21},(_,i)=>({id:String(i),title:'Public listing',city:'Duras'}));
 const f=fixture({rows});const response=await f.run(request({q:'50%_off',city:'Duras',page:'2'}));const data=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(data.results.length,20);assert.equal(data.hasMore,true);
 assert(f.calls.some(call=>call[0]==='client'&&call[2]==='public-key'));
 assert(f.calls.some(call=>call[0]==='eq'&&call[1]==='status'&&call[2]==='approved'));
 assert(f.calls.some(call=>call[0]==='eq'&&call[1]==='verified'&&call[2]===true));
 assert.deepEqual(f.calls.find(call=>call[0]==='range'),['range',40,60]);
 assert.deepEqual(f.calls.find(call=>call[0]==='ilike'&&call[1]==='title'),['ilike','title','%50\\%\\_off%']);
 const fields=f.calls.find(call=>call[0]==='select')[1].split(',');
 assert.deepEqual(fields,['id','title','city','address','start_at','is_directory_entry']);
});
test('Directory search returns only named businesses with a resolved municipality and no contact or private fields',async()=>{
 const f=fixture({services:[{id:'a',name:'Maison A',type:'bakery',codeInsee:'47086',email:'not-returned'}, {id:'b',name:'Maison B',type:'bakery',municipality:'Eymet'}, {id:'c',name:'Maison C',type:'mairie',municipality:'Duras'}, {id:'d',name:'Maison D',type:'bakery',municipality:'Unknown'}]});
 assert.equal((await f.run(request({source:'directory',q:'Maison',city:'Unknown'}))).status,400);
 const data=await(await f.run(request({source:'directory',q:'Maison',city:'Duras'}))).json();
 assert.deepEqual(data.results.map(item=>[item.serviceId,item.city]),[['a','Duras'],['b','Eymet']]);
 assert(data.results.every(item=>!('email'in item)&&item.id===''));assert.equal(f.calls.length,0);
});
test('Database failure cannot look like an empty successful search',async()=>{
 const f=fixture({error:{message:'private infrastructure details'}});const r=await f.run(request({q:'Test'}));assert.equal(r.status,502);assert(!JSON.stringify(await r.json()).includes('private infrastructure'));
});
