import fs from 'node:fs/promises';
import {shopType} from '../lib/municipal-shops.ts';
const root=new URL('../',import.meta.url);
for(const key of ['libourne','sarlat']){
 const file=new URL(`lib/regions/${key}.json`,root),d=JSON.parse(await fs.readFile(file,'utf8'));
 const query=`[out:json][timeout:60];(nwr(around:50000,${d.latitude},${d.longitude})[amenity];nwr(around:50000,${d.latitude},${d.longitude})[shop];nwr(around:50000,${d.latitude},${d.longitude})[tourism=information];nwr(around:50000,${d.latitude},${d.longitude})[railway=station];nwr(around:50000,${d.latitude},${d.longitude})[highway=bus_stop];);out center tags;`;
 for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter']){
  try{const r=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{headers:{'User-Agent':'CoteRegionalDirectory/1.0','Accept':'application/json'},signal:AbortSignal.timeout(80000)});if(!r.ok){console.log(key,r.status,(await r.text()).slice(0,180));continue;}const raw=await r.json();if(raw.remark)throw Error(raw.remark);d.municipalElements=raw.elements||[];if(d.municipalElements.length)break;}catch(e){console.log(key,e.message);}
 }
 d.shopPoints=d.municipalElements.flatMap(e=>{const t=e.tags||{},type=shopType(t),latitude=e.lat??e.center?.lat,longitude=e.lon??e.center?.lon;if(!type||!t.name||latitude==null)return [];return [{id:`osm-${e.type}-${e.id}`,type,name:t.name,latitude,longitude,address:[t['addr:housenumber'],t['addr:street'],t['addr:postcode'],t['addr:city']].filter(Boolean).join(' '),municipality:t['addr:city'],phone:t.phone||t['contact:phone'],email:t.email||t['contact:email'],website:t.website||t['contact:website'],sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,sourceName:'OpenStreetMap contributors (ODbL)'}];});
 d.officialRecords=[];
 for(let i=0;i<d.areas.length;i+=50){try{
  const codes=d.areas.slice(i,i+50).map(a=>'"'+a.code_insee+'"').join(',');
  const p=new URLSearchParams({where:`code_insee_commune in (${codes}) and startswith(nom,"Mairie")`,limit:'100'});
  const r=await fetch('https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?'+p,{signal:AbortSignal.timeout(20000)});if(!r.ok){console.log('DILA',r.status);continue;}const records=(await r.json()).results||[];d.officialRecords.push(...records);
 }catch(e){console.log('DILA',e.message);}}
 d.sources.push({feed:'OpenStreetMap regional facilities',selected:d.municipalElements.length,source:'https://www.openstreetmap.org/copyright'},{feed:'DILA official municipal records',selected:d.officialRecords.length,source:'https://api-lannuaire.service-public.gouv.fr/'});
 await fs.writeFile(file,JSON.stringify(d));console.log(key,JSON.stringify({elements:d.municipalElements.length,shops:d.shopPoints.length,mairies:d.officialRecords.length}));
}
