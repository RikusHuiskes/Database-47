import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
function route({admin=true,existing=1}={}){
 let inserts=0;
 const client={from:table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:'event'}}),then:resolve=>resolve({count:existing,error:null}),insert:async()=>{inserts++;return {error:null}}};return q;}};
 const js=stripTypeScriptTypes(readFileSync(new URL('../app/api/admin/event-access/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace('export async function','async function');
 const post=new Function('adminService','managedToken','tokenHash',js+';return POST;')(async()=>admin?client:null,()=>{throw Error('Existing link must not be regenerated');},()=>{});
 return {post,get inserts(){return inserts}};
}
const request=(origin='https://example.invalid')=>new Request('https://example.invalid/api/admin/event-access',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({eventId:'event'})});
test('Admin link creation refuses cross-origin, non-admin and existing access without creating duplicate tokens',async()=>{
 assert.equal((await route().post(request('https://other.invalid'))).status,403);assert.equal((await route({admin:false}).post(request())).status,403);
 const f=route();const response=await f.post(request());assert.equal(response.status,409);assert.match((await response.json()).error,/al een beheerlink/);assert.equal(f.inserts,0);
});
