import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {sealManagementMail,openManagementMail,managementMailMessage,managementMailTokenHash} from './management-mail.ts';
function worker(config,fail=false,management=false,valid=true){
 const sent=[],updates=[],rows=[{id:'mail1',template:'received',recipient:'visitor@example.invalid',payload:{},lease_token:'lease1',attempts:1},{id:'mail2',template:'received',recipient:'fixed@example.invalid',payload:{audience:'admin'},lease_token:'lease2',attempts:5}];
 const access={eventId:'11111111-1111-4111-8111-111111111111',token:'t'.repeat(43),origin:'https://example.invalid'};if(management)Object.assign(rows[0],{template:'management',payload:{eventId:access.eventId,title:'Testvermelding'},encrypted_secret:sealManagementMail(access,{MANAGEMENT_MAIL_KEY:'test-only-key'})});
 const client={rpc:async()=>({data:rows,error:null}),from:table=>table==='event_owner_access'?{select:()=>{const q={eq:()=>q,maybeSingle:async()=>({data:valid?{event_id:access.eventId}:null,error:null})};return q;}}:({update:value=>{const entry={value,filters:[]};updates.push(entry);const q={eq:(key,v)=>{entry.filters.push([key,v]);return q;},then:resolve=>resolve({error:null})};return q;}})};
 const source=stripTypeScriptTypes(readFileSync(new URL('./mail-outbox.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace('export async function','async function');
 const run=new Function('createServiceClient','listingMail','mailConfiguration','mailTransport','safeMailError','openManagementMail','managementMailMessage','managementMailTokenHash',source+';return processMailOutbox;')(()=>client,()=>({subject:'Received',text:'Message'}),()=>config,()=>({sendMail:async mail=>{sent.push(mail);if(fail)throw Error('secret');return {accepted:[mail.to]};}}),()=>'Sanitized mail error',value=>openManagementMail(value,{MANAGEMENT_MAIL_KEY:'test-only-key'}),managementMailMessage,managementMailTokenHash);
 return {run,sent,updates};
}
test('Preview redirects every queued recipient to our mailbox and records lease-scoped acceptance',async()=>{
 const w=worker({deliveryEnabled:true,previewMode:true,user:'info@cotededuras.com',from:'Our mailbox'});
 assert.deepEqual(await w.run(),{enabled:true,accepted:2,failed:0});assert(w.sent.every(m=>m.to==='info@cotededuras.com'&&m.subject.startsWith('[TEST PREVIEW]')));assert.match(w.sent[0].text,/visitor@example.invalid/);assert(w.updates.every(u=>u.value.state==='accepted'&&u.filters.some(f=>f[0]==='lease_token')));
});
test('Production sends applicant mail to applicant and administrator mail only to configured mailbox',async()=>{
 const w=worker({deliveryEnabled:true,previewMode:false,user:'info@cotededuras.com',from:'Our mailbox'});await w.run();assert.deepEqual(w.sent.map(m=>m.to),['visitor@example.invalid','info@cotededuras.com']);
});
test('Disabled delivery sends nothing; SMTP failures remain retryable up to the fifth attempt',async()=>{
 const disabled=worker({deliveryEnabled:false});assert.equal((await disabled.run()).enabled,false);assert.equal(disabled.sent.length,0);
 const w=worker({deliveryEnabled:true,previewMode:true,user:'info@cotededuras.com'},true);assert.equal((await w.run()).failed,2);assert.deepEqual(w.updates.map(u=>u.value.state),['pending','failed']);assert(w.updates.every(u=>u.value.last_error==='Sanitized mail error'));
});

test('Approved management mail reaches verified visitor even on preview; queued token is erased after acceptance',async()=>{const w=worker({deliveryEnabled:true,previewMode:true,user:'info@cotededuras.com'},false,true);await w.run();assert.equal(w.sent[0].to,'visitor@example.invalid');assert.match(w.sent[0].text,/#11111111-1111-4111-8111-111111111111:/);assert(!w.sent[0].subject.startsWith('[TEST PREVIEW]'));assert.equal(w.sent[1].to,'info@cotededuras.com');assert.equal(w.updates[0].value.encrypted_secret,null);});
test('A revoked or replaced token is never mailed',async()=>{const w=worker({deliveryEnabled:true,previewMode:true,user:'info@cotededuras.com'},false,true,false);const result=await w.run();assert.equal(result.failed,1);assert.equal(w.sent.length,1);assert.equal(w.sent[0].to,'info@cotededuras.com');assert.equal(w.updates[0].value.state,'failed');assert.equal(w.updates[0].value.encrypted_secret,null);});
test('Management links are encrypted and authenticated; another key or tampered message is rejected',()=>{const env={MANAGEMENT_MAIL_KEY:'test-only-key'},access={eventId:'11111111-1111-4111-8111-111111111111',token:'t'.repeat(43),origin:'https://example.invalid'},secret=sealManagementMail(access,env);assert(!secret.includes(access.token));assert(!secret.includes(access.origin));assert.deepEqual(openManagementMail(secret,env),access);assert.throws(()=>openManagementMail(secret,{MANAGEMENT_MAIL_KEY:'wrong'}));assert.throws(()=>openManagementMail(secret.slice(0,-3)+'xxx',env));});
