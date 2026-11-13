import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
function handler(admin=true){
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_event_id,error:null}}};
 const code=stripTypeScriptTypes(readFileSync(new URL('../app/api/admin/advertising/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export async function','async function');
 return {calls,post:new Function('adminService',code+';return POST;')(async()=>admin?client:null)};
}
const id='f95f270b-997e-469b-b9d3-cdec8ed68301';
function req(eventId=id,origin='https://example.invalid'){return new Request('https://example.invalid/api/admin/advertising',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'archive-listing',eventId})});}
test('Invoice module archiving rejects cross-origin, non-admin and malformed requests before database access',async()=>{
 for(const [admin,request,status] of [[false,req(),403],[true,req(id,'https://other.invalid'),403],[true,req('bad-id'),400]]){
  const h=handler(admin);assert.equal((await h.post(request)).status,status);assert.deepEqual(h.calls,[]);
 }
 const h=handler();assert.equal((await h.post(req())).status,200);
 assert.deepEqual(h.calls,[{name:'archive_event',args:{p_event_id:id}}]);
});
