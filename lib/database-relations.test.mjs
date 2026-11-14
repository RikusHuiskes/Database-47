import test from 'node:test';
import assert from 'node:assert/strict';
import {relationRows,relationOne} from './database-relations.ts';

test('a one-to-one billing cycle can be rendered as a collection without losing it',()=>{
 const cycle={cycle_index:1,advertising_contracts:{method:'sepa',status:'active',paid_until:'2026-12-14'}};
 assert.deepEqual(relationRows(cycle).map(c=>relationOne(c.advertising_contracts)?.method),['sepa']);
 assert.equal(relationRows(cycle).length,1);
});
test('multiple cycles and nested collection contracts retain their order',()=>{
 const cycles=[{cycle_index:1,advertising_contracts:[{method:'creditcard'}]},{cycle_index:2,advertising_contracts:null}];
 assert.deepEqual(relationRows(cycles).map(c=>relationOne(c.advertising_contracts)?.method??null),['creditcard',null]);
});
test('missing optional cycle and contract data does not crash rendering',()=>{
 for(const value of [null,undefined,[]]){assert.deepEqual(relationRows(value),[]);assert.equal(relationOne(value),null);}
});
