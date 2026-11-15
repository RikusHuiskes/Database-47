import test from 'node:test';
import assert from 'node:assert/strict';
import {quickPeriodRange,isChristmasMarket} from './event-period.ts';
import {matchesEventDateRange} from './nearby-search.ts';
test('French local day crosses UTC midnight correctly',()=>assert.deepEqual(quickPeriodRange('today',new Date('2026-11-15T23:30:00Z')),{start:'2026-11-16',end:'2026-11-16'}));
test('Sunday remains in the current weekend, Monday selects the next weekend',()=>{
 assert.deepEqual(quickPeriodRange('weekend',new Date('2026-11-15T12:00:00Z')),{start:'2026-11-14',end:'2026-11-15'});
 assert.deepEqual(quickPeriodRange('weekend',new Date('2026-11-16T12:00:00Z')),{start:'2026-11-21',end:'2026-11-22'});
});
test('week crosses month and year boundaries',()=>assert.deepEqual(quickPeriodRange('week',new Date('2026-12-31T12:00:00Z')),{start:'2026-12-28',end:'2027-01-03'}));
test('French daylight saving dates retain calendar boundaries',()=>assert.deepEqual(quickPeriodRange('weekend',new Date('2027-03-28T00:30:00Z')),{start:'2027-03-27',end:'2027-03-28'}));
test('Christmas category includes markets, excludes unrelated Christmas events',()=>{
 for(const title of ['Marché de Noël à Duras','Marchés de Noel','Marché artisanal de Noël','Kerstmarkt','Christmas market'])assert.equal(isChristmasMarket({title}),true,title);
 for(const title of ['Concert de Noël','Marché du dimanche','Dîner de Noël','Courses et marche de Noël','Randonnée et marche de Noël'])assert.equal(isChristmasMarket({title}),false,title);
});
test('date shortcuts retain events spanning the selected day and exclude permanent listings',()=>{
 const range=quickPeriodRange('today',new Date('2026-12-19T12:00:00Z'));
 assert.equal(matchesEventDateRange({start_at:'2026-12-18',end_at:'2026-12-20'},range),true);
 assert.equal(matchesEventDateRange({start_at:'2026-12-20'},range),false);
 assert.equal(matchesEventDateRange({start_at:'2026-12-19',is_directory_entry:true},range),false);
});
