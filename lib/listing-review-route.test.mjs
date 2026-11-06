import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {sealManagementMail,openManagementMail,managementMailTokenHash} from './management-mail.ts';

const eventId='11111111-1111-4111-8111-111111111111';
const requestId='22222222-2222-4222-8222-222222222222';
const mailKey={MANAGEMENT_MAIL_KEY:'isolated-route-test-only'};
const token='t'.repeat(43);
const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/admin/listing-requests/route.ts',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'').replace(/\bexport /g,'');
function fixture({admin=true,delivery=true,rpcError=null,mailError=false}={}){
 const calls=[],tasks=[],sealed=[],processed=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'reviewer'}}})},from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{event_id:eventId},error:null})};return q;},rpc:async(name,args)=>{calls.push({name,args});return {data:name.endsWith('_with_mail')?{eventId,mailId:'mail'}:eventId,error:rpcError};}};
 const deps={listingTriage:()=>({}),adminService:async()=>admin?client:null,managedToken:()=>token,tokenHash:value=>managementMailTokenHash({token:value}),sealManagementMail:access=>{const encrypted=sealManagementMail(access,mailKey);sealed.push(encrypted);return encrypted;},mailConfiguration:()=>({deliveryEnabled:delivery}),processMailOutbox:async n=>{processed.push(n);if(mailError)throw Error('private-mail-error');},after:task=>tasks.push(task)};
 const run=new Function(...Object.keys(deps),source+';return POST;')(...Object.values(deps));
 return {run,calls,tasks,sealed,processed};
}
function request(body={},origin='https://example.invalid'){
 return new Request('https://example.invalid/api/admin/listing-requests',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer reviewer-token'},body:JSON.stringify({id:requestId,action:'approved',note:'Independently verified the owner',contact:'Official business website and telephone',deliveryEmail:'Confirmed@Example.invalid',emailConfirmed:'on',...body})});
}
test('Only an authenticated administrator on the same origin can record a decision',async()=>{
 const anonymous=fixture({admin:false});assert.equal((await anonymous.run(request())).status,403);assert.equal(anonymous.calls.length,0);
 const crossOrigin=fixture();assert.equal((await crossOrigin.run(request({},'https://other.invalid'))).status,403);assert.equal(crossOrigin.calls.length,0);
});
test('Approval requires confirmation and queues the verified recipient and encrypted owner link atomically',async()=>{
 const f=fixture();assert.equal((await f.run(request({emailConfirmed:''}))).status,400);assert.equal(f.calls.length,0);
 assert.equal((await f.run(request({deliveryEmail:'invalid'}))).status,400);assert.equal(f.calls.length,0);
 const response=await f.run(request());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 const result=await response.json();assert.equal(result.manageFragment,eventId+':'+token);assert.deepEqual(result.mail,{state:'pending',recipient:'confirmed@example.invalid'});
 assert.equal(f.calls[0].name,'review_listing_request_with_mail');assert.equal(f.calls[0].args.p_email,'confirmed@example.invalid');assert.equal(f.calls[0].args.p_reviewer,'reviewer');
 assert(!f.sealed[0].includes(token));assert.deepEqual(openManagementMail(f.sealed[0],mailKey),{eventId,token,origin:'https://example.invalid'});
 assert.equal(f.tasks.length,1);await f.tasks[0]();assert.deepEqual(f.processed,[10]);
});
test('Disabled delivery preserves a queued link and clearly reports that nothing is sent',async()=>{
 const f=fixture({delivery:false});const result=await(await f.run(request({action:'reissued'}))).json();assert.equal(result.ok,true);assert.equal(result.mailDeliveryEnabled,false);assert.equal(result.mail.state,'pending');assert.equal(f.tasks.length,0);
});
test('Failed database saves do not schedule mail; rejected requests never create owner links',async()=>{
 const broken=fixture({rpcError:{message:'Transaction failed'}});assert.equal((await broken.run(request())).status,400);assert.equal(broken.tasks.length,0);
 const rejected=fixture();const result=await(await rejected.run(request({action:'rejected',emailConfirmed:'',deliveryEmail:''}))).json();assert.equal(result.ok,true);assert.equal(result.manageFragment,undefined);assert.equal(rejected.calls[0].name,'review_listing_request');assert.equal(rejected.sealed.length,0);
});
