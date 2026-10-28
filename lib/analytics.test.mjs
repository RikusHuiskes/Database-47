import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {analyticsChoice,setAnalyticsChoice,enableAnalytics,trackAnalytics} from './analytics-client.ts';

function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};}
test('No tracking before consent, on refusal, after expiry, or with Do Not Track; sessions are reused',()=>{
  const sent=[];
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window=new EventTarget();
  Object.defineProperty(globalThis,'navigator',{value:{doNotTrack:'0'},configurable:true});
  globalThis.fetch=async(url,init)=>{sent.push(JSON.parse(init.body));return new Response(null,{status:204});};
  enableAnalytics(true);trackAnalytics('category_view');assert.equal(sent.length,0);
  setAnalyticsChoice(true);trackAnalytics('category_view');assert.equal(sent.length,2);
  trackAnalytics('event_view');assert.equal(sent.length,3);assert.equal(sent[0].sessionId,sent[2].sessionId);
  assert.equal(sent[0].visitorId,sent[2].visitorId);
  navigator.doNotTrack='1';trackAnalytics('visit');assert.equal(sent.length,3);navigator.doNotTrack='0';
  setAnalyticsChoice(false);trackAnalytics('visit');assert.equal(sent.length,3);assert.equal(localStorage.getItem('cdd-visitor'),null);
  localStorage.setItem('cdd-visitor','old');localStorage.setItem('cdd-statistics-v1',JSON.stringify({accepted:true,at:'2000-01-01'}));
  assert.equal(analyticsChoice(),null);assert.equal(localStorage.getItem('cdd-visitor'),null);enableAnalytics(false);
});

function route(client){
  const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/analytics/route.ts',import.meta.url),'utf8'))
    .replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nreturn POST;';
  return new Function('NextResponse','createServiceClient','areas',source)(Response,()=>client,{areas:[{name:'Duras'}]});
}
test('Collector validates origin, IDs, consent age, size and known dimensions and strips extra personal fields',async()=>{
  const writes=[];const post=route({rpc:async(name,args)=>{writes.push({name,args});return {error:null};}});
  const payload={id:crypto.randomUUID(),visitorId:crypto.randomUUID(),sessionId:crypto.randomUUID(),consentAt:new Date().toISOString(),action:'visit',email:'must-not-be-stored'};
  const request=(data=payload,origin='https://example.com',ua='Browser')=>new Request('https://example.com/api/analytics',{method:'POST',headers:{origin,'user-agent':ua},body:JSON.stringify(data)});
  assert.equal((await post(request())).status,204);assert.equal(writes.length,1);assert.equal(writes[0].args.p_data.email,undefined);
  assert.equal((await post(request(payload,'https://evil.example'))).status,403);
  assert.equal((await post(request(payload,'https://example.com','Googlebot'))).status,204);
  for(const change of [{eventId:'bad'},{categoryId:'bad'},{area:'unknown'},{consentAt:'2000-01-01'},{consentAt:'2099-01-01'},{action:'unknown'},{channel:'email'},{page:'/private?email=secret'},{radius:'999'},{action:'page_view'},{action:'filter_view'}])assert.equal((await post(request({...payload,...change}))).status,400);
  assert.equal((await post(request({...payload,padding:'x'.repeat(3000)}))).status,413);assert.equal(writes.length,1);
  assert.equal((await route(null)(request())).status,503);
});
