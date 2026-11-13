import test from 'node:test';
import assert from 'node:assert/strict';
import {monthBoundary,verifiedRecurringPayment} from './recurring-billing.ts';
test('Monthly dates retain the original anchor through February and leap years',()=>{
 assert.deepEqual([0,1,2,3].map(n=>monthBoundary('2027-01-31',n)),['2027-01-31','2027-02-28','2027-03-31','2027-04-30']);
 assert.equal(monthBoundary('2028-01-31',1),'2028-02-29');assert.throws(()=>monthBoundary('2027-02-30',1));
});
const contract={id:'contract',customer_id:'cst_test',method:'creditcard',amount_cents:1500,is_test_mode:true};
const cycle={id:'cycle',cycle_index:0,payment_id:null};
const first={id:'tr_test',status:'paid',mode:'test',customerId:'cst_test',sequenceType:'first',method:'creditcard',amount:{currency:'EUR',value:'15.00'},metadata:{contractId:'contract',cycleId:'cycle'}};
test('Card mandate first payment and card/SEPA renewals have distinct validation',()=>{
 assert.equal(verifiedRecurringPayment(first,contract,cycle),'paid');
 for(const method of ['ideal','paybybank','mybank'])assert.equal(verifiedRecurringPayment({...first,method},{...contract,method:'sepa'},cycle),'paid');
 assert.equal(verifiedRecurringPayment({...first,sequenceType:'recurring'},{...contract},{...cycle,cycle_index:1}),'paid');
 assert.equal(verifiedRecurringPayment({...first,sequenceType:'recurring',method:'directdebit'},{...contract,method:'sepa'},{...cycle,cycle_index:1}),'paid');
 for(const mutation of [{mode:'live'},{customerId:'cst_other'},{amount:{currency:'EUR',value:'180.00'}},{metadata:{contractId:'wrong',cycleId:'cycle'}},{metadata:{contractId:'contract',cycleId:'wrong'}},{method:'paypal'},{sequenceType:'recurring'}])assert.throws(()=>verifiedRecurringPayment({...first,...mutation},contract,cycle));
 assert.throws(()=>verifiedRecurringPayment(first,contract,{...cycle,payment_id:'tr_other'}));
});
test('Refunds and chargebacks override paid, pending is not payment proof',()=>{
 assert.equal(verifiedRecurringPayment({...first,amountChargedBack:{value:'15.00'}},contract,cycle),'refunded');
 assert.equal(verifiedRecurringPayment({...first,amountRefunded:{value:'0.01'}},contract,cycle),'refunded');
 assert.equal(verifiedRecurringPayment({...first,status:'pending'},contract,cycle),'open');
});

test('An abandoned first checkout may have no method, but settlement must prove the agreed method',()=>{
 for(const status of ['open','canceled','expired'])assert.equal(verifiedRecurringPayment({...first,status,method:undefined},contract,cycle),status==='open'?'open':status);
 assert.throws(()=>verifiedRecurringPayment({...first,method:undefined},contract,cycle));
 assert.throws(()=>verifiedRecurringPayment({...first,status:'canceled',method:'paypal'},contract,cycle));
});
