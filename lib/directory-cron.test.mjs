import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

// Exercise the deployed handler with external services replaced, without
// importing records into either the Test or Production database.
function handler({client=null,fetchEntries=async()=>({entries:[],sources:[]})}={}) {
 const source=readFileSync(new URL('../app/api/cron/import-directory/route.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(source)
  .replace(/^import \{([^}]+)\} from '([^']+)';/gm,(_,names,path)=>`const {${names}}=require(${JSON.stringify(path)});`)
  .replace(/export /g,'')+'\nreturn GET;';
 return new Function('require',js)(name=>{
  if(name.endsWith('supabase-server'))return {createServiceClient:()=>client};
  if(name.endsWith('import-sources/directory'))return {fetchDirectoryEntries:fetchEntries};
  throw Error('Unexpected dependency: '+name);
 });
}
const request=(token='cron-test')=>new Request('https://example.invalid/api/cron/import-directory',{headers:{authorization:`Bearer ${token}`}});

test('Directory cron rejects missing configuration and unauthorized callers before fetching or writing',async()=>{
 const prior=process.env.CRON_SECRET;
 try {
  let touched=false;
  const run=handler({fetchEntries:async()=>{touched=true;throw Error('Unexpected fetch');}});
  delete process.env.CRON_SECRET;
  assert.equal((await run(request())).status,503);
  process.env.CRON_SECRET='cron-test';
  assert.equal((await run(request('wrong'))).status,401);
  assert.equal((await run(new Request('https://example.invalid'))).status,401);
  assert.equal((await run(request())).status,503);
  assert.equal(touched,false);
 } finally {if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});

test('Directory cron processes every record in batches of 100 and reports source fallbacks',async()=>{
 const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='cron-test';
 try {
  const entries=Array.from({length:205},(_,id)=>({source_id:String(id)})),batches=[];
  const sources=[{url:'https://example.invalid/feed',count:205,fallback:true,error:'HTTP 503'}];
  const run=handler({fetchEntries:async()=>({entries,sources}),client:{rpc:async(name,args)=>{
   assert.equal(name,'import_directory_entries');batches.push(args.p_entries);
   return {data:{inserted:args.p_entries.length-1,skipped:1},error:null};
  }}});
  const response=await run(request());
  assert.equal(response.status,200);
  assert.deepEqual(batches.map(b=>b.length),[100,100,5]);
  assert.deepEqual(batches.flat(),entries);
  assert.deepEqual(await response.json(),{ok:true,checked:205,inserted:202,skipped:3,sources});
 } finally {if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});

test('Directory cron stops at a failed batch and reports only committed progress',async()=>{
 const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='cron-test';
 try {
  let calls=0;
  const run=handler({fetchEntries:async()=>({entries:Array.from({length:250},(_,id)=>({source_id:String(id)})),sources:[]}),client:{rpc:async()=>{
   calls++;return calls===2?{error:{message:'Database unavailable'}}:{data:{inserted:70,skipped:30},error:null};
  }}});
  const response=await run(request());
  assert.equal(response.status,502);assert.equal(calls,2);
  assert.deepEqual(await response.json(),{error:'Database unavailable',checked:100,inserted:70,skipped:30});
 } finally {if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});

test('Directory cron does not write when source loading fails',async()=>{
 const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='cron-test';
 try {
  let writes=0;
  const run=handler({fetchEntries:async()=>{throw Error('Reservekopie te oud');},client:{rpc:async()=>{writes++;}}});
  const response=await run(request());
  assert.equal(response.status,502);assert.equal(writes,0);
  assert.deepEqual(await response.json(),{error:'Reservekopie te oud',checked:0,inserted:0,skipped:0});
 } finally {if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});
