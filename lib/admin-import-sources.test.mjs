import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPORT_SOURCES,ALL_IMPORT_SOURCES,fetchImportPreview} from './admin-import-sources.ts';

test('Each individual button fetches only its own exact endpoint, including source filters',async()=>{
  for(const source of IMPORT_SOURCES){
    const calls=[];
    const rows=await fetchImportPreview([source],async(url,options)=>{calls.push(url);assert.equal(options.cache,'no-store');return Response.json({events:[{title:source.name}]});});
    assert.deepEqual(calls,[source.endpoint]);assert.equal(rows.length,1);
  }
});
test('Refresh all fetches each broad source once, sequentially, and reports current progress',async()=>{
  const calls=[],progress=[];let active=0;
  const rows=await fetchImportPreview(ALL_IMPORT_SOURCES,async(url)=>{
    assert.equal(++active,1);calls.push(url);active--;return Response.json({events:[{url}]});
  },name=>progress.push(name));
  assert.deepEqual(calls,ALL_IMPORT_SOURCES.map(source=>source.endpoint));
  assert.equal(new Set(calls).size,5);assert.equal(rows.length,5);assert.deepEqual(progress,ALL_IMPORT_SOURCES.map(source=>source.name));
  assert(calls.every(url=>!url.includes('?')));
});
test('An import failure is visible and stops later sources; malformed responses are rejected',async()=>{
  const calls=[];
  await assert.rejects(fetchImportPreview(ALL_IMPORT_SOURCES,async(url)=>{calls.push(url);return new Response('',{status:502});}),/Tourisme Duras.*502/);
  assert.equal(calls.length,1);
  await assert.rejects(fetchImportPreview([IMPORT_SOURCES[0]],async()=>Response.json({})),/geldige evenementenlijst/);
});
