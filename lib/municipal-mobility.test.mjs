import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobilityType,mobilityTypes,mobilityName,mobilityDetails} from './municipal-mobility.ts';
import {distanceInKm} from './local-area.ts';
test('Only matching public facilities enter the three new categories',()=>{
  assert.equal(mobilityType({shop:'supermarket'}),'supermarket');
  assert.equal(mobilityType({shop:'convenience'}),undefined);
  assert.equal(mobilityType({amenity:'fuel'}),'fuel');
  assert.equal(mobilityType({shop:'fuel'}),undefined);
  assert.equal(mobilityType({amenity:'charging_station'}),'charging');
  for(const tags of [{access:'private'},{access:'no'},{motorcar:'no'},{disused:'yes'}])assert.equal(mobilityType({amenity:'charging_station',...tags}),undefined);
  assert.equal(mobilityType({amenity:'device_charging_station'}),undefined);
  assert.match(mobilityName({amenity:'charging_station',operator:'MObiVE'}),/MObiVE/);
  assert.match(mobilityDetails({amenity:'charging_station',access:'customers','socket:type2':'2'}),/Alleen voor klanten/);
});
test('All 53 guide towns have results for each new category within their search radius',()=>{
  const {areas}=JSON.parse(readFileSync(new URL('./data/area-catalog.json',import.meta.url)));
  const {elements}=JSON.parse(readFileSync(new URL('./data/municipal-mobility.json',import.meta.url)));
  assert.equal(areas.length,53);
  for(const area of areas)for(const type of ['supermarket','fuel','charging','public_transport','parking','disabled_parking']) {
    const radius=['Agen','Bergerac'].includes(area.name)?10:25;
    assert.ok(elements.some(e=>mobilityTypes(e.tags??{}).includes(type) && distanceInKm(area.latitude,area.longitude,e.lat??e.center.lat,e.lon??e.center.lon)<=radius),`${area.name}: ${type}`);
  }
});
test('Every new category has sourced, located results for the guide',()=>{
  const {elements}=JSON.parse(readFileSync(new URL('./data/municipal-mobility.json',import.meta.url)));
  for(const type of ['supermarket','fuel','charging','public_transport','parking','disabled_parking']){
    const matching=elements.filter(e=>mobilityTypes(e.tags??{}).includes(type));
    assert.ok(matching.length>0,type);
    for(const e of matching){assert.ok(Number.isFinite(e.lat??e.center?.lat));assert.ok(Number.isFinite(e.lon??e.center?.lon));}
  }
});

test('Reserved disabled bays require explicit evidence and public facilities exclude private access',()=>{
  assert.deepEqual(mobilityTypes({amenity:'parking','capacity:disabled':'2'}),['parking','disabled_parking']);
  assert.deepEqual(mobilityTypes({amenity:'parking',wheelchair:'yes'}),['parking']);
  assert.deepEqual(mobilityTypes({amenity:'parking','capacity:disabled':'0'}),['parking']);
  assert.deepEqual(mobilityTypes({amenity:'parking','capacity:disabled':'yes',access:'private'}),[]);
  assert.equal(mobilityType({amenity:'parking_space',parking_space:'disabled'}),'disabled_parking');
  for(const tags of [{highway:'bus_stop'},{railway:'station'},{amenity:'bus_station'},{public_transport:'platform'}])assert.equal(mobilityType(tags),'public_transport');
  assert.match(mobilityDetails({amenity:'parking','capacity:disabled':'2'}),/volgens bron: 2/);
});
