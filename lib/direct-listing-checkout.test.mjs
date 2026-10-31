import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {setImmediate as flush} from 'node:timers/promises';
import {requestListingCheckout} from './listing-checkout.ts';
import {advertisingQuote,emptyAdvertiser,validateAdvertiser} from './advertising.ts';
import {visitorEventInput} from './visitor-event-input.ts';

const id='12345678-1234-1234-1234-123456789abc',token='a'.repeat(43),fragment=id+':'+token;
const details={...emptyAdvertiser,name:'Test advertiser',address:'Test street 1',postcode:'47120',city:'Duras',email:'test@example.invalid',phone:'123',startDate:'2099-01-01',months:2};
const summary={placement:'homepage',...advertisingQuote('homepage',details)};
const pageSource=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
function sourceFunction(name){const found=pageSource.match(new RegExp('  async function '+name+'\\([^]*?(?=\\n  (?:async )?function )'));assert(found,'Missing '+name);return stripTypeScriptTypes(found[0]);}

function submissionFlow({placement='homepage',checkoutFailures=0,storageError=false}={}){
 const calls=[],state={},noop=()=>{};
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url==='/api/visitor-events')return Response.json({eventId:id,manageFragment:fragment,advertising:placement==='none'?null:summary},{status:201});
  if(url==='/api/mollie/checkout'){
   if(checkoutFailures-->0)return Response.json({error:'Mollie tijdelijk niet beschikbaar.'},{status:503});
   return Response.json({checkoutUrl:'https://www.mollie.com/checkout/fixture'});
  }
  throw Error('Unexpected request: '+url);
 };
 const deps={saving:false,checkoutInFlight:{current:false},supabase:{},title:'Test advertentie',entryKind:'directory',startAt:'',endAt:'',promotionType:placement,advertiser:details,websiteUrl:'https://example.invalid',bookingUrl:'https://example.invalid',sourceUrl:'https://example.invalid',categoryId:'',visitorPhoto:null,shortDescription:'',description:'',venueName:'',address:'',postcode:'',cityChoice:'Duras',customCity:'',priceFrom:'',priceTo:'',isFree:false,
  validateAdvertiser,advertisingQuote,normalizeWebAddress:value=>value,makeSlug:()=> 'test-advertentie',fetch:fetcher,readApiJson:response=>response.json(),resetForm:()=>calls.push({reset:true}),
  loadData:()=>new Promise(()=>{}), // A slow agenda refresh must not delay checkout.
  requestListingCheckout:value=>requestListingCheckout(value,fetcher),
  sessionStorage:{setItem:(key,value)=>{if(storageError)throw Error('blocked');calls.push({session:{key,value}});}},localStorage:{getItem:()=>null,setItem:noop},
  window:{location:{origin:'https://app.example.invalid',assign:url=>calls.push({navigate:url})}},requestAnimationFrame:fn=>fn(),document:{getElementById:()=>({scrollIntoView:noop})},console:{error:noop},
 };
 for(const name of ['Message','Error','SubmissionNotice','SubmissionError','ManagementLink','SubmissionPayment','CheckoutStarting','CheckoutError','Saving','ShowForm'])deps['set'+name]=value=>{state[name]=value;};
 const run=new Function(...Object.keys(deps),sourceFunction('payForSubmittedListing')+'\n'+sourceFunction('saveEvent')+'\nreturn {saveEvent,payForSubmittedListing};')(...Object.values(deps));
 return {calls,state,...run};
}

test('A paid submission saves once, retains owner access, and opens Mollie immediately without visiting management',async()=>{
 const flow=submissionFlow();await flow.saveEvent({preventDefault(){}});await flush();
 assert.deepEqual(flow.calls.filter(x=>x.url).map(x=>x.url),['/api/visitor-events','/api/mollie/checkout']);
 const paymentRequest=flow.calls.find(x=>x.url==='/api/mollie/checkout');
 assert.deepEqual(JSON.parse(paymentRequest.options.body),{eventId:id});
 assert.equal(paymentRequest.options.headers.Authorization,'Bearer '+token);
 assert(flow.calls.findIndex(x=>x.session)<flow.calls.indexOf(paymentRequest));
 assert.deepEqual(flow.calls.find(x=>x.session).session,{key:'cdd-management-session',value:fragment});
 assert.equal(flow.calls.find(x=>x.navigate).navigate,'https://www.mollie.com/checkout/fixture');
 assert.equal(flow.state.SubmissionPayment.amountCents,29800);
 assert.equal(flow.state.SubmissionPayment.months,2);
 assert.match(flow.state.ManagementLink,/#12345678-/);
 assert(!flow.calls.some(x=>x.navigate?.includes('mijn-vermelding')));
});

test('Checkout failure keeps the submitted order and offers payment retry without submitting another listing',async()=>{
 const flow=submissionFlow({checkoutFailures:1});await flow.saveEvent({preventDefault(){}});await flush();
 assert.match(flow.state.CheckoutError,/tijdelijk niet beschikbaar/);
 assert.equal(flow.state.CheckoutStarting,false);assert.equal(flow.state.SubmissionPayment.title,'Test advertentie');assert.equal(flow.state.SubmissionError,'');
 await flow.payForSubmittedListing(fragment);
 assert.equal(flow.calls.filter(x=>x.url==='/api/visitor-events').length,1);
 assert.equal(flow.calls.filter(x=>x.url==='/api/mollie/checkout').length,2);
 assert(flow.calls.some(x=>x.navigate));
});

test('Free listings retain their existing submission flow and never create a payment',async()=>{
 const flow=submissionFlow({placement:'none'});await flow.saveEvent({preventDefault(){}});await flush();
 assert.deepEqual(flow.calls.filter(x=>x.url).map(x=>x.url),['/api/visitor-events']);
 assert.equal(flow.state.SubmissionPayment,null);assert(!flow.calls.some(x=>x.navigate));
});

test('Blocked browser storage does not lose the saved listing or create an unrecoverable checkout',async()=>{
 const flow=submissionFlow({storageError:true});await flow.saveEvent({preventDefault(){}});await flush();
 assert(flow.state.ManagementLink.includes(fragment));assert.match(flow.state.CheckoutError,/tijdelijke browseropslag/);
 assert.equal(flow.calls.filter(x=>x.url==='/api/mollie/checkout').length,0);
});

test('Payment helper rejects malformed owner access, non-JSON errors, and unsafe redirect URLs',async()=>{
 await assert.rejects(requestListingCheckout('bad',()=>{throw Error('must not fetch');}),/betaaltoegang/);
 await assert.rejects(requestListingCheckout(fragment,async()=>new Response('<html>unavailable</html>',{status:502})),/reageert niet/);
 for(const checkoutUrl of ['javascript:alert(1)','https://mollie.com.evil.invalid/checkout','http://www.mollie.com/checkout','https://www.mollie.com@evil.invalid/checkout',undefined]){
  await assert.rejects(requestListingCheckout(fragment,async()=>Response.json({checkoutUrl})),/geldige Mollie/);
 }
});

test('Submission response exposes the server-calculated ad summary without invoice details',async()=>{
 const source=stripTypeScriptTypes(readFileSync(new URL('../app/api/visitor-events/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replaceAll('export ','');
 let persisted;
 const post=new Function('createServiceClient','managedToken','tokenHash','visitorEventInput','validateAdvertiser',source+';return POST;')(()=>({rpc:async(name,args)=>{persisted=args;return {data:id,error:null}}}),()=>token,()=> 'hash',visitorEventInput,validateAdvertiser);
 const response=await post(new Request('https://app.example.invalid/api/visitor-events',{method:'POST',headers:{origin:'https://app.example.invalid'},body:JSON.stringify({event:{title:'Test',city:'Duras',is_directory_entry:true,website_url:'https://example.invalid',booking_url:'https://example.invalid',source_url:'https://example.invalid',promotion_type:'homepage',amountCents:1},advertiser:{...details,amountCents:1}})}));
 assert.equal(response.status,201);const result=await response.json();
 assert.deepEqual(result.advertising,summary);assert.equal(persisted.p_ad.amountCents,29800);
 assert(!JSON.stringify(result).includes(details.email));assert(!JSON.stringify(result).includes(details.address));
});
