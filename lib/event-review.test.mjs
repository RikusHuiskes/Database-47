import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const id='11111111-1111-4111-8111-111111111111';
const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/admin/event-review/route.ts',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'').replaceAll('export ','');
function fixture({admin=true,error=null,found=true}={}){
 const updates=[],scheduled=[];
 const query={update(patch){updates.push(patch);return query;},eq(key,value){assert.equal(key,'id');assert.equal(value,id);return query;},select(){return query;},maybeSingle:async()=>({data:found?{id,promotion_status:'none'}:null,error})};
 const client={from:()=>query};
 const run=new Function('adminService','scheduleListingMail',source+';return POST;')(async()=>admin?client:null,eventId=>scheduled.push(eventId));
 return {run,updates,scheduled};
}
const request=(status='approved',origin='https://site.invalid')=>new Request('https://site.invalid/api/admin/event-review',{method:'POST',headers:{origin},body:JSON.stringify({id,status})});
test('Only same-origin admin review saves approval and immediately schedules this listing alone',async()=>{
 const f=fixture();assert.equal((await f.run(request('approved','https://elsewhere.invalid'))).status,403);assert.equal(f.updates.length,0);
 assert.equal((await fixture({admin:false}).run(request())).status,403);
 const result=await f.run(request());assert.equal(result.status,200);assert.deepEqual(f.scheduled,[id]);assert.equal(f.updates[0].verified,true);assert.equal((await result.json()).id,id);
});
test('Failed, missing or rejected reviews do not schedule owner mail',async()=>{
 for(const [options,status,expected]of [[{error:{message:'failure'}},'approved',400],[{found:false},'approved',404],[{},'rejected',200],[{},'invalid',400]]){
  const f=fixture(options);assert.equal((await f.run(request(status))).status,expected);assert.equal(f.scheduled.length,0);
 }
});
