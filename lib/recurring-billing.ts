/** Shared, pure monthly billing rules. Amounts and dates are never accepted from checkout clients. */
export type RecurringMethod='sepa'|'creditcard';
export const BILLING_TERMS_VERSION='2026-11-13-monthly-v1';
export const FIRST_SEPA_METHODS=['ideal','bancontact','belfius','eps','kbc','mybank','paybybank'];
export function recurringMethod(value:unknown):RecurringMethod{
 if(value!=='sepa'&&value!=='creditcard')throw Error('Kies SEPA-incasso of creditcard.');return value;
}
export function monthBoundary(anchor:string,index:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor)||!Number.isInteger(index)||index<0||index>1200)throw Error('Ongeldige abonnementsperiode.');
 const date=new Date(anchor+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==anchor)throw Error('Ongeldige abonnementsdatum.');
 const result=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+index,1,12));
 const last=new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate();result.setUTCDate(Math.min(date.getUTCDate(),last));return result.toISOString().slice(0,10);
}
export type RecurringPayment={id:string;status:string;mode:string;customerId?:string;mandateId?:string;sequenceType?:string;method?:string;amount?:{currency:string;value:string};metadata?:{contractId?:string;cycleId?:string};amountRefunded?:{value:string};amountChargedBack?:{value:string}};
export function verifiedRecurringPayment(payment:RecurringPayment,contract:{id:string;customer_id:string;method:RecurringMethod;amount_cents:number;is_test_mode:boolean},cycle:{id:string;cycle_index:number;payment_id:string|null}){
 if(!/^tr_[A-Za-z0-9]+$/.test(payment.id)||cycle.payment_id&&cycle.payment_id!==payment.id||payment.metadata?.contractId!==contract.id||payment.metadata?.cycleId!==cycle.id||payment.customerId!==contract.customer_id||payment.mode!==(contract.is_test_mode?'test':'live')||payment.amount?.currency!=='EUR'||payment.amount.value!==(contract.amount_cents/100).toFixed(2))throw Error('De abonnementsbetaling kon niet worden geverifieerd.');
 const unsettledWithoutMethod=!payment.method&&['open','pending','failed','canceled','expired'].includes(payment.status)&&!Number(payment.amountRefunded?.value)&&!Number(payment.amountChargedBack?.value);
 if(cycle.cycle_index===0){if(payment.sequenceType!=='first'||(!unsettledWithoutMethod&&(contract.method==='creditcard'?payment.method!=='creditcard':!FIRST_SEPA_METHODS.includes(payment.method||''))))throw Error('De eerste betaalmethode komt niet overeen met de toestemming.');}
 else if(payment.sequenceType!=='recurring'||payment.method!==(contract.method==='creditcard'?'creditcard':'directdebit'))throw Error('Ongeldige terugkerende betaalmethode.');
 if(Number(payment.amountRefunded?.value)>0||Number(payment.amountChargedBack?.value)>0)return 'refunded';
 return ['paid','failed','canceled','expired'].includes(payment.status)?payment.status:'open';
}
