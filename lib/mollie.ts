export const ADVERTISING_SELLER={name:'Côte de Duras',address:'1049 Route du Nourissat',postcode:'47120',city:'Savignac de Duras',country:'FR',siret:'93451899400025'};
export async function mollieRequest(path:string,options:RequestInit={},fetcher:typeof fetch=fetch){
  const key=process.env.MOLLIE_API_KEY;
  if(!key||! /^(test|live)_/.test(key))throw Error('Online betalen is nog niet geactiveerd. Je aanvraag blijft bewaard.');
  if(process.env.VERCEL_ENV!=='production'&&key.startsWith('live_'))throw Error('Gebruik een Mollie test-key in de testomgeving.');
  const response=await fetcher('https://api.mollie.com/v2/'+path,{...options,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok)throw Error('Mollie kon de betaling niet verwerken. Probeer later opnieuw.');
  return data;
}
export function verifiedPaymentState(payment:{status?:string;amount?:{currency?:string;value?:string};metadata?:{requestId?:string};amountRefunded?:{value?:string};amountChargedBack?:{value?:string}},order:{id:string;amount_cents:number}){
  if(payment.metadata?.requestId!==order.id||payment.amount?.currency!=='EUR'||payment.amount?.value!==(order.amount_cents/100).toFixed(2))throw Error('De betaalgegevens komen niet overeen met de aanvraag.');
  if(Number(payment.amountRefunded?.value)>0||Number(payment.amountChargedBack?.value)>0)return 'refunded';
  return ['paid','failed','canceled','expired'].includes(payment.status??'')?payment.status!:'open';
}
