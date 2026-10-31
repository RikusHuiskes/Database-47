import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {distanceInKm} from './local-area.ts';
for(const key of ['libourne','sarlat'])test(key+': independent sourced catalogue, all categories, strict 50 km and actual search handler',()=>{
 const d=JSON.parse(readFileSync(new URL('./regions/'+key+'.json',import.meta.url),'utf8'));
 assert.equal(d.key,key);assert(d.brand.includes(key==='sarlat'?'Sarlat':'Libourne'));
 assert(d.events.length>1000);assert.equal(new Set(d.events.map(e=>e.id)).size,d.events.length);
 for(const e of d.events)assert(distanceInKm(d.latitude,d.longitude,e.latitude,e.longitude)<=50.000001,e.title);
 for(const a of d.areas)assert(distanceInKm(d.latitude,d.longitude,a.latitude,a.longitude)<=50.000001,a.name);
 for(const c of d.categories)assert(d.events.some(e=>e.category_ids.includes(c.id)),c.name);
 assert(d.officialRecords.length>400);assert(d.municipalElements.length>1000);assert(d.shopPoints.length>100);
 const source=stripTypeScriptTypes(readFileSync(new URL('./regional-demo.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export ','');
 const search=new Function('snapshot','distanceInKm',source+';return regionalResults;')(d,distanceInKm);
 const params=new URLSearchParams({lat:String(d.latitude),lon:String(d.longitude),radius:'10',category:d.categories[0].id});
 const results=search(params);for(const e of results.events){assert(e.category_ids.includes(d.categories[0].id));assert(e.distance_km<=10);}
 assert.throws(()=>search(new URLSearchParams()),/geldige plaats/);
});
test('Local demo changes cannot cross region keys, even in the same browser origin',()=>{
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
 const source=stripTypeScriptTypes(readFileSync(new URL('./regional-demo-browser.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export ','');
 const create=key=>new Function('REGION','localStorage',source+';return {demoListings,saveDemoListing};')({key},storage);
 const libourne=create('libourne'),sarlat=create('sarlat');libourne.saveDemoListing({id:'same-id',title:'Libourne only'});
 assert.equal(sarlat.demoListings().length,0);sarlat.saveDemoListing({id:'same-id',title:'Sarlat only'});
 assert.equal(libourne.demoListings()[0].title,'Libourne only');assert.equal(sarlat.demoListings()[0].title,'Sarlat only');
});
