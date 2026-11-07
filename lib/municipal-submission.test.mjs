import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(error){if(s.startsWith('.')&&c.parentURL){const url=new URL(s+'.ts',c.parentURL);if(existsSync(url))return {url:url.href,shortCircuit:true};}throw error;}},load(url,c,next){if(url.endsWith('/supabase-server.ts'))return {format:'module',source:'export function createServiceClient(){return globalThis.businessTestClient}',shortCircuit:true};if(url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};return next(url,c);}});
const {municipalSubmission}=await import('./municipal-submission.ts');
const {POST}=await import('../app/api/municipal-submissions/route.ts');
const {decorateMunicipalDirectory,resolveMunicipalBusiness}=await import('./municipal-advertising-server.ts');
process.env.MANAGEMENT_MAIL_KEY='isolated-business-test';
const input={title:'Test winkel',address:'1 Teststraat',postcode:'47120',municipal_code:'47086',municipal_type:'bakery',municipal_email:'shop@example.invalid',ownerEmail:'owner@example.invalid',municipal_hours:'Ma–vr 09:00–17:00',website_url:'www.example.invalid',description:'Een winkel'};
const id='11111111-1111-4111-8111-111111111111';
const request=(body,origin='https://site.test')=>new Request('https://site.test/api/municipal-submissions',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
test('New businesses are scoped to their real municipality, pending, undated and unpaid; client authority is ignored',()=>{
 const row=municipalSubmission({...input,status:'approved',verified:true,promotion_status:'active',city:'Amsterdam',municipal_key:'existing',id:'existing'},id);
 assert.equal(row.city,'Duras');assert.equal(row.status,'pending');assert.equal(row.verified,false);assert.equal(row.promotion_status,'none');assert.equal(row.id,id);assert.equal(row.municipal_key,'submitted:'+id);assert.equal(row.start_at,null);assert.equal(row.is_directory_entry,true);assert.equal(row.website_url,'https://www.example.invalid/');
 assert.throws(()=>municipalSubmission({...input,municipal_code:'99999'},id));assert.throws(()=>municipalSubmission({...input,municipal_type:'mairie'},id));assert.throws(()=>municipalSubmission({...input,postcode:'wrong'},id));assert.throws(()=>municipalSubmission({...input,website_url:'javascript:alert(1)'},id));assert.throws(()=>municipalSubmission({...input,image_url:'https://attacker.test/image.jpg'},id,'https://storage.test'));
 assert.equal(municipalSubmission({...input,website_url:'',image_url:'https://storage.test/storage/v1/object/public/visitor-event-photos/visitor-submissions/'+id+'.jpg'},id,'https://storage.test').image_url.endsWith('.jpg'),true);
});
test('Submission atomically registers pending business, hashed ownership and private contact; invalid contact never writes',async()=>{
 let calls=[],fail=false;
 globalThis.businessTestClient={rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_event.id,error:fail?{code:'isolated failure'}:null};}};
 assert.equal((await POST(request(input,'https://evil.test'))).status,403);assert.equal(calls.length,0);
 assert.equal((await POST(request({...input,ownerEmail:''}))).status,400);assert.equal(calls.length,0);
 const response=await POST(request(input));assert.equal(response.status,201);const result=await response.json();const [eventId,token]=result.manageFragment.split(':');const args=calls[0].args;
 assert.equal(eventId,args.p_event.id);assert.equal(args.p_token_hash,createHash('sha256').update(token).digest('hex'));assert.equal(args.p_event.status,'pending');assert.equal(args.p_event.verified,false);assert.equal(args.p_event.ownerEmail,undefined);assert.equal(args.p_contact.recipient,input.ownerEmail);assert(!args.p_contact.encrypted_secret.includes(token));assert.equal(response.headers.get('cache-control'),'no-store');
 fail=true;assert.equal((await POST(request(input))).status,400);assert.notEqual(calls[1].args.p_event.id,eventId);
});
test('Free approved submissions appear only for the selected town and rubric; pending/rejected entries stay private',async()=>{
 const base=municipalSubmission(input,id);const records=[{...base,status:'approved',verified:true},{...base,id:'pending',municipal_key:'submitted:pending'},{...base,id:'wrong-type',municipal_key:'submitted:wrong-type',municipal_type:'florist',status:'approved',verified:true},{...base,id:'wrong-town',municipal_key:'submitted:wrong-town',municipal_code:'47157',status:'approved',verified:true}];
 const client={from(){let filtered=records;const q={select(columns){assert.ok(!columns.includes('token_hash'));return q;},eq(k,v){filtered=filtered.filter(row=>row[k]===v);return q;},in(k,values){filtered=filtered.filter(row=>values.includes(row[k]));return q;},maybeSingle(){return Promise.resolve({data:filtered[0]||null,error:null});},then(resolve){return Promise.resolve({data:filtered,error:null}).then(resolve);}};return q;}};
 globalThis.businessTestClient=client;
 const result=await decorateMunicipalDirectory({city:'Duras',services:[]},'47086','bakery',client);
 assert.deepEqual(result.services.map(row=>row.id),['submitted:'+id]);assert.equal(result.services[0].managedEventId,id);assert.equal(result.services[0].openingHours,input.municipal_hours);assert.equal(result.services[0].highlighted,false);
 assert.equal((await decorateMunicipalDirectory({city:'Duras',services:[]},'47086','all',client)).services.length,2);
 assert.equal((await resolveMunicipalBusiness('submitted:pending','Duras')),null);assert.equal((await resolveMunicipalBusiness('submitted:'+id,'Eymet')),null);assert.equal((await resolveMunicipalBusiness('submitted:'+id,'Duras')).entry.name,input.title);
});
