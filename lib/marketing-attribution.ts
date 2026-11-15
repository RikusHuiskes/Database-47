export const ANALYTICS_PAGES=['/','/statistieken','/handleiding','/contact','/disclaimer','/de-streek-beleven','/adverteren','/adverteren/betaling','/evenement/nieuw','/gemeentegids/adverteren','/gemeentegids/aanmelden'];
export function trafficTag(value:unknown):string {
 if(typeof value!=='string'||value.includes('@')||/https?:|[?&#=]/i.test(value))return '';
 return value.trim().toLowerCase().replace(/[^a-z0-9._ -]/g,'').slice(0,80);
}
export function trafficChannel(source:string,medium:string,referrer:string):string {
 const social=/facebook|instagram|linkedin|tiktok|pinterest|twitter|(^|\.)t\.co$|youtube/.test(source+' '+referrer);
 const search=/google|bing|yahoo|duckduckgo|ecosia|qwant/.test(source+' '+referrer);
 const paid=/^(cpc|ppc|paid|paid_social|paid-social|paidsocial|paid_search|paid-search|display)$/.test(medium);
 if(paid)return social?'paid_social':search?'paid_search':'paid_other';
 if(/email|newsletter|e-mail/.test(medium)||/newsletter|brevo/.test(source))return 'email';
 if(social)return 'organic_social';if(search)return 'organic_search';
 if(source||referrer)return 'referral';return 'direct';
}
export function normalizeAcquisition(raw:unknown,country:string|null,userAgent:string):Record<string,string>|null {
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>;
 let referrer='';if(typeof r.referrer==='string'&&/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(r.referrer))referrer=r.referrer.toLowerCase().slice(0,100);
 const source=trafficTag(r.source),medium=trafficTag(r.medium),campaign=trafficTag(r.campaign),content=trafficTag(r.content);
 const landing=typeof r.landing==='string'&&ANALYTICS_PAGES.includes(r.landing)?r.landing:'/';
 return {source,medium,campaign,content,referrer,landing,channel:trafficChannel(source,medium,referrer),
  country:country&&/^[A-Z]{2}$/.test(country)?country:'',
  language:['nl','fr','en'].includes(String(r.language))?String(r.language):'other',
  device:/ipad|tablet/i.test(userAgent)?'tablet':/mobile|iphone|android/i.test(userAgent)?'mobile':userAgent?'desktop':'unknown'};
}
export function campaignUrl(base:string,source:string,medium:string,campaign:string,content=''):string {
 const url=new URL(base);if(url.origin!=='https://www.cotededuras.com'||!ANALYTICS_PAGES.includes(url.pathname))throw Error('Kies een openbare pagina van Côte de Duras.');
 if(!trafficTag(source)||!trafficTag(medium)||!trafficTag(campaign))throw Error('Vul bron, medium en campagne in.');
 for(const [key,value]of Object.entries({utm_source:source,utm_medium:medium,utm_campaign:campaign,utm_content:content})){
  const clean=trafficTag(value);if(clean)url.searchParams.set(key,clean);else url.searchParams.delete(key);
 }return url.href;
}
