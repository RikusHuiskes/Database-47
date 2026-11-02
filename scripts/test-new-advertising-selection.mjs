import assert from 'node:assert/strict';
import {advertisingSelectionQuote,advertisingOrderTypes,MONTHLY_PRICES,emptyAdvertiser} from '../lib/advertising.ts';
import {requestListingCheckout} from '../lib/listing-checkout.ts';
const options=['highlight','category','homepage'];let quotes=0;
for(let mask=1;mask<8;mask++){const placements=options.filter((_,i)=>mask&(1<<i));for(let months=1;months<=12;months++){const quote=advertisingSelectionQuote(placements,{...emptyAdvertiser,startDate:'2028-01-31',months});assert.equal(quote.amountCents,placements.reduce((sum,p)=>sum+MONTHLY_PRICES[p],0)*months);assert.deepEqual(advertisingOrderTypes({details:{placements:quote.placements}}),quote.placements);quotes++;}}
assert.equal(advertisingSelectionQuote(options,{...emptyAdvertiser,startDate:'2028-01-31',months:1}).amountCents,24300);
for(const bad of [[],['highlight','highlight'],['none'],['homepage','invalid'],['highlight','category','homepage','highlight']])assert.throws(()=>advertisingSelectionQuote(bad,{...emptyAdvertiser,startDate:'2028-01-31',months:1}));
let calls=0;const fragment='00000000-0000-4000-8000-000000000001:'+ 'a'.repeat(43);
const checkout=await requestListingCheckout(fragment,async(url,options)=>{calls++;assert.equal(url,'/api/mollie/checkout');assert.deepEqual(JSON.parse(options.body),{eventId:fragment.split(':')[0]});return Response.json({checkoutUrl:'https://www.mollie.com/checkout/test-combined-order'});});
assert.equal(calls,1);assert.match(checkout,/mollie/);console.log(`${quotes} combination/duration quotes passed; invalid selections rejected; one mocked checkout request.`);
