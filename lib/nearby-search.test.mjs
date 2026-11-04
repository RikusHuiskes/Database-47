import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryIdsForSelection, DEFAULT_SEARCH_RADIUS_KM, matchesSelectedCategory, normalizeSearchRadiusKm, SEARCH_RADIUS_OPTIONS} from './nearby-search.ts';

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
