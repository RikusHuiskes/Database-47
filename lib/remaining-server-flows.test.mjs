import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {verifiedPaymentState} from './mollie.ts';
const source=path=>stripTypeScriptTypes(readFileSync(new URL('../app/api/'+path+'/route.ts',import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/\bexport /g,'');
function handler(path,method,deps={}){return new Function(...Object.keys(deps),source(path)+';return '+method+';')(...Object.values(deps));}
async function env(values,run){const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));try{for(const [k,v]of Object.entries(values)){if(v===undefined)delete process.env[k];else process.env[k]=v;}return await run();}finally{for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}}
for(const route of JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url))).crons){
 test('Scheduled endpoint rejects missing configuration and unauthorized requests: '+route.path,async()=>env({CRON_SECRET:undefined},async()=>{
  const run=handler(route.path.replace('/api/',''),'GET',{NextResponse:Response});
  assert.equal((await run(new Request('https://test.invalid'))).status,503);
  process.env.CRON_SECRET='test-cron-only';
  for(const token of ['', 'Bearer wrong'])assert.equal((await run(new Request('https://test.invalid',{headers:{authorization:token}}))).status,401);
 }));
}
test('Mail cron processes a bounded batch and reports failures without disclosing secrets',async()=>env({CRON_SECRET:'test-only'},async()=>{
 let limit;const request=new Request('https://test.invalid',{headers:{authorization:'Bearer test-only'}});
 const run=handler('cron/listing-mail','GET',{processMailOutbox:async n=>{limit=n;return {enabled:true,accepted:2,failed:0}}});
 assert.equal((await run(request)).status,200);assert.equal(limit,10);
 const broken=handler('cron/listing-mail','GET',{processMailOutbox:async()=>{throw Error('private-password')}});
 const response=await broken(request);assert.equal(response.status,502);assert(!(await response.text()).includes('private-password'));
}));
test('Cleanup cron executes event and statistics retention and reports partial failure',async()=>env({CRON_SECRET:'test-only',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'},async()=>{
 const calls=[];const run=handler('cron/cleanup-expired-events','GET',{NextResponse:Response,createClient:()=>({rpc:async name=>{calls.push(name);return {data:3,error:null}}})});
 const request=new Request('https://test.invalid',{headers:{authorization:'Bearer test-only'}});
 assert.deepEqual(await(await run(request)).json(),{ok:true,deleted:3});assert.deepEqual(calls,['delete_expired_events_cron','prune_site_analytics']);
 const failed=handler('cron/cleanup-expired-events','GET',{NextResponse:Response,createClient:()=>({rpc:async name=>name==='prune_site_analytics'?{error:{message:'test failure'}}:{data:1,error:null}})});
 const response=await failed(request);assert.equal(response.status,502);assert.match((await response.json()).error,/Evenementen opgeruimd/);
}));
function webhook({payment={status:'paid',metadata:{requestId:'order'},amount:{currency:'EUR',value:'15.00'}},order={id:'order',amount_cents:1500},storeError=null}={}){
 const calls=[];const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:order,error:null})};
 const run=handler('mollie/webhook','POST',{createServiceClient:()=>({from:()=>q,rpc:async(name,args)=>{calls.push({name,args});return {error:storeError}}}),mollieRequest:async()=>payment,verifiedPaymentState});return {run,calls};
}
const callback=body=>new Request('https://example.invalid/api/mollie/webhook',{method:'POST',body});
test('Mollie webhook validates identifier, looks up real amount and ignores forged callback status',async()=>env({MOLLIE_API_KEY:'test-only'},async()=>{
 const f=webhook();for(const body of ['', 'id=forged', 'id=tr_test&padding='+ 'x'.repeat(500)])assert.equal((await f.run(callback(body))).status,400);
 assert.equal((await f.run(callback('id=tr_test&status=failed&amount=0'))).status,200);assert.deepEqual(f.calls,[{name:'settle_advertising_payment',args:{p_payment_id:'tr_test',p_state:'paid'}}]);
 for(const payment of [{status:'paid',metadata:{requestId:'another'},amount:{currency:'EUR',value:'15.00'}},{status:'paid',metadata:{requestId:'order'},amount:{currency:'EUR',value:'0.01'}}]){const invalid=webhook({payment});assert.equal((await invalid.run(callback('id=tr_test'))).status,503);assert.equal(invalid.calls.length,0);}
 assert.equal((await webhook({order:null}).run(callback('id=tr_test'))).status,503);
 assert.equal((await webhook({storeError:{message:'retry'}}).run(callback('id=tr_test'))).status,503);
}));
test('Mollie webhook fails closed when the key is missing',async()=>env({MOLLIE_API_KEY:undefined},async()=>{const f=webhook();assert.equal((await f.run(callback('id=tr_test'))).status,503);assert.equal(f.calls.length,0);}));
