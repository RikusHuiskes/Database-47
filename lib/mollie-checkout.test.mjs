import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {verifiedPaymentState} from './mollie.ts';
for(const environment of ['preview','production'])test(environment+' checkout returns to the exact owner origin and uses server amount and capacity',async()=>{
 const previous={VERCEL_ENV:process.env.VERCEL_ENV,MOLLIE_API_KEY:process.env.MOLLIE_API_KEY,PUBLIC_SITE_URL:process.env.PUBLIC_SITE_URL};
 Object.assign(process.env,{VERCEL_ENV:environment,MOLLIE_API_KEY:'test_fixture',PUBLIC_SITE_URL:'https://other-preview.invalid'});
 try{
  const calls=[],order={id:'order',event_id:'owned',amount_cents:1500,placement:'highlight',months:1,starts_on:'2099-01-01',ends_on:'2099-02-01',checkout_key:'stable-key',payment_status:'requested',details:{name:'TEST',address:'TEST',postcode:'47120',city:'Duras',country:'FR',email:'info@cotededuras.com'}};
  const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:order}),update(){return q},then(resolve){resolve({error:null})}};
  const client={from:()=>q,rpc:async(name)=>{calls.push(name);return {error:null}}};
  const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/mollie/checkout/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export ','');
  let body;
  const post=new Function('managedAccess','mollieRequest','verifiedPaymentState',source+';return POST;')(async()=>client,async(path,options)=>{assert.equal(calls[0],'assert_advertising_capacity');body=JSON.parse(options.body);return {id:'tr_test',_links:{checkout:{href:'https://www.mollie.com/checkout/test'}}}},verifiedPaymentState);
  const response=await post(new Request('https://this-preview.invalid/api/mollie/checkout',{method:'POST',headers:{origin:'https://this-preview.invalid'},body:JSON.stringify({eventId:'owned',amount:1})}));
  assert.equal(response.status,200);assert.equal(body.amount.value,'15.00');assert.equal(body.redirectUrl,'https://this-preview.invalid/mijn-vermelding?betaling=terug');assert.equal(body.webhookUrl,(environment==='preview'?'https://this-preview.invalid':'https://other-preview.invalid')+'/api/mollie/webhook');
 }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
