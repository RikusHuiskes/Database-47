export const MONTHLY_PRICES={homepage:14900,category:7900,highlight:1500} as const;
export type AdvertisingType=keyof typeof MONTHLY_PRICES;
export type AdvertiserDetails={name:string;company:string;address:string;postcode:string;city:string;country:string;email:string;phone:string;vatNumber:string;startDate:string;months:number};
export const emptyAdvertiser:AdvertiserDetails={name:'',company:'',address:'',postcode:'',city:'',country:'FR',email:'',phone:'',vatNumber:'',startDate:'',months:1};
export function advertisingQuote(type:string,details:AdvertiserDetails){
  if(!(type in MONTHLY_PRICES))throw Error('Kies een geldige advertentievorm.');
  if(!Number.isInteger(details.months)||details.months<1||details.months>12)throw Error('Kies 1 tot en met 12 maanden.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(details.startDate))throw Error('Kies een begindatum voor de advertentie.');
  const date=new Date(details.startDate+'T00:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==details.startDate)throw Error('Ongeldige begindatum.');
  const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+details.months,1));
  const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  end.setUTCDate(Math.min(date.getUTCDate(),last));
  return {amountCents:MONTHLY_PRICES[type as AdvertisingType]*details.months,startDate:details.startDate,endDate:end.toISOString().slice(0,10),months:details.months};
}
export function validateAdvertiser(type:string,value:unknown){
  if(!value||typeof value!=='object')throw Error('Vul de factuurgegevens in.');
  const input=value as Record<string,unknown>,result={...emptyAdvertiser};
  for(const key of Object.keys(emptyAdvertiser) as (keyof AdvertiserDetails)[]){
    if(key==='months'){result.months=Number(input.months);continue;}
    result[key]=typeof input[key]==='string'?(input[key] as string).trim():'';
    if(result[key].length>250)throw Error('Een factuurveld is te lang.');
  }
  if(!result.name||!result.address||!result.postcode||!result.city||!result.country||!result.phone||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw Error('Vul naam, adres, postcode, plaats, land, e-mail en telefoon in.');
  return {details:result,quote:advertisingQuote(type,result)};
}
