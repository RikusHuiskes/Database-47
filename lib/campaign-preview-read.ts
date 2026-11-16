import {NextResponse} from 'next/server';
import {CHRISTMAS_CATEGORY,isChristmasMarket} from './event-period';
import {localizePublicData,requestLocale} from './public-translations';
/** Preview-only, anonymous GET bridge. Fixed public origin/path; never forwards cookies, auth or writes. */
export async function campaignPreviewRead(request:Request,path:'nearby-events'|'ios-categories'|'promotions'|'municipality-services') {
 if(process.env.VERCEL_ENV!=='preview')return null;
 const incoming=new URL(request.url),target=new URL('/api/'+path,'https://www.cotededuras.com');
 const allowed=['lat','lon','radius','category','date_from','date_to','city','service','codeInsee'];
 for(const key of allowed){const value=incoming.searchParams.get(key);if(value)target.searchParams.set(key,value);}
 const christmas=target.searchParams.get('category')===CHRISTMAS_CATEGORY.id;
 if(christmas)target.searchParams.delete('category');
 target.searchParams.set('lang','source');
 try {
  const response=await fetch(target,{next:{revalidate:120},signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Public agenda unavailable');
  const data=await response.json();
  if(path==='nearby-events'){
   data.events=(data.events??[]).map(event=>({...event,category_ids:[...new Set([...(event.category_ids??[]),...(isChristmasMarket(event)?[CHRISTMAS_CATEGORY.id]:[])])]})).filter(event=>!christmas||(!event.is_directory_entry&&event.category_ids.includes(CHRISTMAS_CATEGORY.id)));
   if(christmas){data.homepage_promotions=[];data.category_promotions=[];}
  }
  if(path==='promotions'&&christmas){data.homepage_promotions=[];data.category_promotions=[];}
  return NextResponse.json(localizePublicData(data,requestLocale(request)),{headers:{'Cache-Control':'private, no-store','X-Campaign-Preview':'public-read-only'}});
 }catch{return NextResponse.json({error:'De openbare agenda kon niet worden geladen. Probeer opnieuw.'},{status:502});}
}
