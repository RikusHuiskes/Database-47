import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryIdsForSelection, DEFAULT_SEARCH_RADIUS_KM, eventDateFilter, matchesEventDateRange, matchesSelectedCategory, normalizeSearchRadiusKm, SEARCH_RADIUS_OPTIONS} from './nearby-search.ts';

test('Search radius uses the four supported choices and starts at 5 km',()=>{
  assert.deepEqual(SEARCH_RADIUS_OPTIONS,[5,10,25,50]);
  assert.equal(DEFAULT_SEARCH_RADIUS_KM,5);
  for(const radius of SEARCH_RADIUS_OPTIONS) assert.equal(normalizeSearchRadiusKm(radius),radius);
  for(const invalid of [0,6,15,75,Number.NaN]) assert.equal(normalizeSearchRadiusKm(invalid),5);
});

test('A selected category includes only records linked to that category',()=>{
  assert.equal(matchesSelectedCategory(['workshops','nature'],'workshops'),true);
  assert.equal(matchesSelectedCategory(['nature'],'workshops'),false);
  assert.equal(matchesSelectedCategory([],'workshops'),false);
  assert.equal(matchesSelectedCategory(undefined,'all'),true);
});

test('Filtered result cards show the selected category while All shows all assigned categories',()=>{
  assert.deepEqual(categoryIdsForSelection(['workshops','nature'],'workshops'),['workshops']);
  assert.deepEqual(categoryIdsForSelection(['workshops','nature'],'all'),['workshops','nature']);
  assert.deepEqual(categoryIdsForSelection(['nature'],'workshops'),[]);
});

test('Dates support one day, inclusive periods and clearing; invalid dates do not silently disable filtering',()=>{
  assert.deepEqual(eventDateFilter(),{range:null,error:null});
  assert.deepEqual(eventDateFilter('2026-11-07').range,{start:'2026-11-07',end:'2026-11-07'});
  assert.deepEqual(eventDateFilter('','2026-11-07').range,{start:'2026-11-07',end:'2026-11-07'});
  assert.deepEqual(eventDateFilter('2026-11-07','2026-11-10').range,{start:'2026-11-07',end:'2026-11-10'});
  assert(eventDateFilter('2026-11-10','2026-11-07').error);
  for(const invalid of ['2026-02-29','2026-13-01','07-11-2026','not-a-date'])assert(eventDateFilter(invalid).error);
  assert.equal(eventDateFilter('2028-02-29').error,null);
});

test('Event periods overlap either boundary and include all days; undated permanent listings are excluded only while filtering',()=>{
  const range=eventDateFilter('2026-11-07','2026-11-10').range;
  for(const event of [
    {start_at:'2026-11-07'}, {start_at:'2026-11-10'},
    {start_at:'2026-11-01',end_at:'2026-11-07'},
    {start_at:'2026-11-10',end_at:'2026-11-15'},
    {start_at:'2026-11-01',end_at:'2026-11-30'},
  ])assert(matchesEventDateRange(event,range));
  for(const event of [
    {start_at:'2026-11-06'}, {start_at:'2026-11-11'},
    {start_at:'2026-11-01',end_at:'2026-11-06'},
    {start_at:null}, {start_at:'invalid'},
    {start_at:'2026-11-07',is_directory_entry:true},
  ])assert.equal(matchesEventDateRange(event,range),false);
  assert(matchesEventDateRange({is_directory_entry:true},null));
});

test('Single-day filters use France time at midnight and both daylight-saving transitions',()=>{
  for(const [day,inside,outside] of [
    ['2026-11-07','2026-11-06T23:30:00Z','2026-11-07T23:00:00Z'],
    ['2026-07-01','2026-06-30T22:30:00Z','2026-07-01T22:00:00Z'],
    ['2026-03-29','2026-03-29T21:59:59Z','2026-03-29T22:00:00Z'],
    ['2026-10-25','2026-10-25T22:59:59Z','2026-10-25T23:00:00Z'],
  ]){
    const range=eventDateFilter(day).range;
    assert(matchesEventDateRange({start_at:inside},range),inside);
    assert.equal(matchesEventDateRange({start_at:outside},range),false,outside);
  }
});
