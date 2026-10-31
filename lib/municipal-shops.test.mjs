import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHOP_TYPES,shopType,shopNafType} from './municipal-shops.ts';
import {distanceInKm} from './local-area.ts';
test('Shop categories distinguish florists and souvenirs from unrelated broad business codes',()=>{
 assert.equal(shopNafType('47.76Z','Animalerie du Centre'),undefined);
 assert.equal(shopNafType('47.76Z','Passion Florale'),'florist');
 assert.equal(shopNafType('47.78C','Commerce divers'),undefined);
 assert.equal(shopNafType('47.78C','Cadeaux du Château'),'souvenirs');
 assert.equal(shopType({shop:'hairdresser'}),'hairdresser');
 assert.equal(shopType({shop:'gift',access:'private'}),undefined);
 assert.equal(shopType({shop:'beauty'}),undefined);
});
test('Every municipality was searched explicitly; all ten categories contain real sourced businesses within its search area',()=>{
 const {areas}=JSON.parse(readFileSync(new URL('./data/area-catalog.json',import.meta.url)));
 const {points,searches}=JSON.parse(readFileSync(new URL('./data/municipal-shops.json',import.meta.url)));
 assert.equal(areas.length,53);assert.equal(searches.length,53);
 assert.equal(new Set(points.map(p=>p.id)).size,points.length);
 assert(points.filter(p=>p.address).length>1400);
 for(const area of areas){
  assert(searches.some(search=>search.codeInsee===area.code_insee));
  for(const type of SHOP_TYPES)assert(points.some(p=>p.type===type&&p.latitude!=null&&p.longitude!=null&&distanceInKm(area.latitude,area.longitude,p.latitude,p.longitude)<=area.radius_km),`${area.name}: ${type}`);
 }
 for(const point of points){assert(point.name);assert(SHOP_TYPES.includes(point.type));assert.match(point.sourceUrl,/^https:\/\//);assert(!('dirigeants' in point));}
});
