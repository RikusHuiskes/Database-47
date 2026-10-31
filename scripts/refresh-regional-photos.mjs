import fs from 'node:fs/promises';
import {parseSirtaquiCsv,sirtaquiPhotoUrl} from '../lib/sirtaqui.ts';

// Match photographs by the publisher's stable offer ID, never by nearby places
// or fuzzy titles. Do not change any listing content, IDs, categories or dates.
const root=new URL('../',import.meta.url),cache=new URL('work/photo-audit/',root);
await fs.mkdir(cache,{recursive:true});
const regions=await Promise.all(['libourne','sarlat'].map(async key=>({key,data:JSON.parse(await fs.readFile(new URL(`lib/regions/${key}.json`,root),'utf8'))})));
const feeds=[...new Set(regions.flatMap(({data})=>data.events.map(e=>e.source_url.split('#')[0])))].filter(u=>u.startsWith('https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-'));
const rows=new Map();
for(const url of feeds){
 const filename=url.split('/').at(-1),path=new URL(filename,cache);
 let bytes;try{bytes=await fs.readFile(path);}catch{const r=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(`${r.status}: ${url}`);bytes=Buffer.from(await r.arrayBuffer());await fs.writeFile(path,bytes);}
 const parsed=parseSirtaquiCsv(new TextDecoder('windows-1252').decode(bytes));
 rows.set(url,new Map(parsed.map(r=>[r['IDENTIFIANT SIRTAQUI'],r])));console.log('Source refreshed',filename,parsed.length);
}
const checksFile=new URL('image-checks.json',cache);let checks={};try{checks=JSON.parse(await fs.readFile(checksFile,'utf8'));}catch{}
const retry=process.argv.includes('--retry');
if(retry)for(const [url,result]of Object.entries(checks))if(result.error||result.status>=500)delete checks[url];
const candidates=new Map();
for(const {data} of regions)for(const e of data.events){
 const [feed,fragment]=e.source_url.split('#'),id=fragment?.replace(/-\d{4}-\d{2}-\d{2}$/,'');
 const row=rows.get(feed)?.get(id);
 const photos=(row?.PHOTOS||'').split(/\s+#\s+/).map(sirtaquiPhotoUrl).filter(Boolean);
 // Older snapshot photo remains a valid fallback only when the refreshed source
 // no longer contains the offer. An explicit removal in the current row wins.
 if(!row&&e.image_url)photos.push(e.image_url);
 candidates.set(e.source_url,{photos:[...new Set(photos)],rowFound:!!row});
}
let done=0;
for(let index=0;index<Math.max(...[...candidates.values()].map(c=>c.photos.length));index++){
 const urls=[...new Set([...candidates.values()].filter(c=>!c.photos.some(u=>checks[u]?.ok)).map(c=>c.photos[index]).filter(Boolean))];
 console.log('Photo pass',index+1,'candidates',urls.length);let cursor=0;
 await Promise.all(Array.from({length:retry?24:48},async()=>{while(cursor<urls.length){const url=urls[cursor++];if(checks[url])continue;
  let result;try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(retry?20000:10000)});result={ok:r.ok&&/^image\//i.test(r.headers.get('content-type')||''),status:r.status,type:r.headers.get('content-type'),checkedAt:new Date().toISOString()};}catch(err){result={ok:false,error:err.name,checkedAt:new Date().toISOString()};}
  checks[url]=result;done++;if(done%250===0){console.log('Images checked',done);await fs.writeFile(checksFile,JSON.stringify(checks));}
 }}));await fs.writeFile(checksFile,JSON.stringify(checks));
}
for(const {key,data} of regions){
 const report={checkedAt:new Date().toISOString(),total:data.events.length,withPhoto:0,missing:0,repaired:0,missingListings:[]};
 for(const e of data.events){const c=candidates.get(e.source_url),photo=c.photos.find(u=>checks[u]?.ok)||null,previous=e.image_url;
  e.image_url=photo;
  e.photo_source_url=photo?e.source_url:null;
  e.photo_checked_at=report.checkedAt;
  e.photo_status=photo?'source_verified':c.photos.length?'source_unreachable':c.rowFound?'source_without_photo':'source_record_unavailable';
  if(photo)report.withPhoto++;else{report.missing++;report.missingListings.push({id:e.id,title:e.title,city:e.city,category_ids:e.category_ids,source_url:e.source_url,website_url:e.website_url,status:e.photo_status});}
  if(photo&&photo!==previous)report.repaired++;
 }
 data.photoAudit={...report,missingListings:undefined};
 await fs.writeFile(new URL(`lib/regions/${key}.json`,root),JSON.stringify(data));
 await fs.writeFile(new URL(`${key}-photo-report.json`,cache),JSON.stringify(report,null,2));
 console.log('RESULT',key,JSON.stringify(data.photoAudit));
}
