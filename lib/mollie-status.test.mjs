import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {verifiedPaymentState} from './mollie.ts';

function fixture({authorized=true,order={id:'order-1',amount_cents:14900,mollie_payment_id:'tr_test',payment_status:'open'},payment={status:'paid',metadata:{requestId:'order-1'},amount:{currency:'EUR',value:'149.00'}},settleError=null}={}){
 const calls=[];let selectedEvent;
 const query={select(){return this;},eq(field,value){selectedEvent={field,value};return this;},order(){return this;},limit(){return this;},async maybeSingle(){return {data:order,error:null};}};
 const client={from(table){assert.equal(table,'advertising_requests');return query;},async rpc(name,args){calls.push({name,args});return {error:settleError};}};
 const source=readFileSync(new URL('../app/api/mollie/status/route.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(source).replace(/^import \{([^}]+)\} from '([^']+)';/gm,(_,names,path)=>`const {${names}}=require(${JSON.stringify(path)});`).replace(/export /g,'')+'\nreturn POST;';
 const run=new Function('require',js)(name=>{
  if(name.endsWith('managed-events'))return {managedAccess:async()=>authorized?client:null};
  if(name.endsWith('mollie'))return {verifiedPaymentState,mollieRequest:async path=>{assert.equal(path,'payments/tr_test');return payment;}};
  throw Error('Unexpected import '+name);
 });
 return {run,calls,get selectedEvent(){return selectedEvent;}};
}
const request=(body={},origin='https://example.invalid')=>new Request('https://example.invalid/api/mollie/status',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({eventId:'owned-event',...body})});

test('Actual payment-status route rejects cross-origin and unauthorized requests without settling',async()=>{
 const f=fixture({authorized:false});
 assert.equal((await f.run(request({},'https://other.invalid'))).status,403);
 assert.equal((await f.run(request())).status,401);
 assert.deepEqual(f.calls,[]);
});

test('Actual status route verifies server-stored amount and identity, ignoring client-supplied payment/status/amount',async()=>{
 const prior=process.env.MOLLIE_API_KEY;process.env.MOLLIE_API_KEY='test_fixture';
 try{
  const f=fixture();const response=await f.run(request({paymentId:'tr_attacker',status:'paid',amount:1}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{paymentStatus:'paid'});
  assert.deepEqual(f.selectedEvent,{field:'event_id',value:'owned-event'});
  assert.deepEqual(f.calls,[{name:'settle_advertising_payment',args:{p_payment_id:'tr_test',p_state:'paid'}}]);
  for(const payment of [{status:'paid',metadata:{requestId:'other'},amount:{currency:'EUR',value:'149.00'}},{status:'paid',metadata:{requestId:'order-1'},amount:{currency:'EUR',value:'1.00'}}]){
   const invalid=fixture({payment});assert.equal((await invalid.run(request())).status,502);assert.deepEqual(invalid.calls,[]);
  }
 }finally{if(prior===undefined)delete process.env.MOLLIE_API_KEY;else process.env.MOLLIE_API_KEY=prior;}
});

test('Status reconciliation preserves pending states, handles refunds and reports storage failures',async()=>{
 const prior=process.env.MOLLIE_API_KEY;process.env.MOLLIE_API_KEY='test_fixture';
 try{
  const payment={status:'open',metadata:{requestId:'order-1'},amount:{currency:'EUR',value:'149.00'}};
  const open=fixture({payment});assert.deepEqual(await (await open.run(request({status:'paid'}))).json(),{paymentStatus:'open'});
  const refund=fixture({payment:{...payment,status:'paid',amountRefunded:{value:'149.00'}}});assert.deepEqual(await (await refund.run(request())).json(),{paymentStatus:'refunded'});
  assert.equal((await fixture({settleError:{message:'failed'}}).run(request())).status,502);
  assert.equal((await fixture({order:null}).run(request())).status,404);
  const noPayment=fixture({order:{payment_status:'requested',mollie_payment_id:null}});assert.deepEqual(await (await noPayment.run(request())).json(),{paymentStatus:'requested'});assert.deepEqual(noPayment.calls,[]);
 }finally{if(prior===undefined)delete process.env.MOLLIE_API_KEY;else process.env.MOLLIE_API_KEY=prior;}
});
