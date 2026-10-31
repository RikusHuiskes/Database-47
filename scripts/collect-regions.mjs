import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseSirtaquiCsv,sirtaquiLocalTimestamp,sirtaquiCategories,sirtaquiPhotoUrl} from '../lib/sirtaqui.ts';
import {DIRECTORY_FEEDS} from '../lib/directory-feeds.ts';
import {distanceInKm,normalizePlaceName} from '../lib/local-area.ts';
import {shopType} from '../lib/municipal-shops.ts';
const root=new URL('../',import.meta.url),cache=new URL('work/regional-sources/',root),out=new URL('lib/regions/',root);
await fs.mkdir(cache,{recursive:true});await fs.mkdir(out,{recursive:true});
const old=new URL('../../Database-47-map/work/directory-sources/',import.meta.url);
async function download(file,url,options={}){
 const path=new URL(file,cache);try{return await fs.readFile(path);}catch{}
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`${r.status}: ${url}`);
 const data=Buffer.from(await r.arrayBuffer());await fs.writeFile(path,data);return data;
}
const uuid=key=>{const h=createHash('sha256').update(key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const categoryNames={'art-expositions':'Art & Expositions','ateliers-cours':'Ateliers & Cours',cafes:'Cafés','concerts-musique':'Concerts & Musique','culture-musees':'Culture & Musées','enfants-famille':'Enfants & Famille','festivals-fetes':'Festivals & Fêtes','hotels-chambres-hotes-gites':'Hotels & Chambres d’hôtes & Gîtes','marches-brocantes':'Marchés & Brocantes','nature-randonnee':'Nature & Randonnée','restaurants-gastronomie':'Restaurants & Gastronomie',sport:'Sport','theatre-spectacles':'Théâtre & Spectacles','vie-locale':'Vie locale',wijnhuizen:'Wijnhuizen'};
const categories=Object.entries(categoryNames).map(([slug,name])=>({id:uuid(slug),slug,name}));
const communes=(await Promise.all(['16','17','19','24','33','46','47','82'].map(async dep=>JSON.parse((await download(`communes-${dep}.json`,`https://geo.api.gouv.fr/communes?codeDepartement=${dep}&fields=nom,code,codesPostaux&format=geojson&geometry=centre`)).toString()).features))).flat();
const feeds=new Map();
for(const name of [...new Set(DIRECTORY_FEEDS.map(f=>f[0])), 'agenda-24','agenda-33','agenda-47']){
 let bytes;try{bytes=await fs.readFile(new URL(name+'.csv',old));}catch{bytes=await download(name+'.csv',`https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-${name}.csv`);}
 feeds.set(name,parseSirtaquiCsv(new TextDecoder('windows-1252').decode(bytes)));console.log(name,feeds.get(name).length);
}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
for(const [key,code,name]of [['libourne','33243','Libourne'],['sarlat','24520','Sarlat-la-Canéda']]){
 const center=communes.find(c=>c.properties.code===code);if(!center)throw Error('Official centre missing');const [lon,lat]=center.geometry.coordinates;
 const areas=communes.map(c=>{const [longitude,latitude]=c.geometry.coordinates,d=distanceInKm(lat,lon,latitude,longitude);return {id:normalizePlaceName(c.properties.nom).replaceAll(' ','-'),name:c.properties.nom,postcode:c.properties.codesPostaux?.[0]||'',code_insee:c.properties.code,latitude,longitude,radius_km:50,distance_group:`Binnen 50 km van ${name}`,distance:d};}).filter(a=>a.distance<=50).sort((a,b)=>a.distance-b.distance);
 areas[0].id=key;
 const sourceReports=[],entries=[];
 function add(row,slugs,start_at=null,end_at=null){
  const latitude=Number(row.LATITUDE),longitude=Number(row.LONGITUDE);if(!row.NOM_OFFRE||!row.LATITUDE||!row.LONGITUDE||!Number.isFinite(latitude)||!Number.isFinite(longitude)||distanceInKm(lat,lon,latitude,longitude)>50)return false;
  const sourceId=row['IDENTIFIANT SIRTAQUI'],source=`https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-${row._feed}.csv#${sourceId}${start_at?'-'+start_at.slice(0,10):''}`;
  const existing=entries.find(e=>e.source_url===source);if(existing){existing.category_ids=[...new Set([...existing.category_ids,...slugs.map(s=>uuid(s))])];return true;}
  const ids=slugs.filter(s=>categoryNames[s]).map(s=>uuid(s));if(!ids.length)ids.push(uuid('vie-locale'));
  entries.push({id:uuid(source),title:row.NOM_OFFRE,slug:uuid(source),latitude,longitude,city:row.COMMUNE,postcode:row.CODE_POSTAL||null,address:[row.BATIMENT_RESIDENCE,row.RUE,row.LIEUDIT_BP,row.ADRESSE].filter(Boolean).join(', ')||null,start_at:start_at||'',end_at,is_directory_entry:!start_at,short_description:row.DESCRIPTIF?.slice(0,250)||null,description:row.DESCRIPTIF||null,image_url:sirtaquiPhotoUrl(row.PHOTOS),website_url:row.SITE_WEB?.split(' # ')[0]||null,booking_url:null,contact_phone:row.TEL?.split(' # ')[0]||null,is_free:/^gratuit\b/i.test(row.TARIFS||''),source_url:source,category_ids:ids,category_id:ids[0],status:'approved',verified:true,promotion_type:'none',promotion_status:'none'});return true;
 }
 for(const [feed,category]of DIRECTORY_FEEDS){let count=0;for(const row of feeds.get(feed)||[]){
  if(category==='cafes'&&!/\b(cafe|bar|pub|bistrot|salon de the)\b/.test(normalizePlaceName(`${row.NOM_OFFRE} ${row.TYPE||''} ${row.CATEGORIE||''}`)))continue;
  if(category==='restaurants-gastronomie'&&!/restaurant|restauration|brasserie|pizzeria|creperie|ferme auberge|bistrot|traiteur/.test(normalizePlaceName(`${row.NOM_OFFRE} ${row.TYPE||''} ${row.CATEGORIE||''}`)))continue;
  if(add({...row,_feed:feed},[category]))count++;
 }sourceReports.push({feed,selected:count});}
 for(const feed of ['agenda-24','agenda-33','agenda-47']){let count=0;for(const row of feeds.get(feed)||[]){for(const period of (row.DATES||'').split(/\s+#\s+/)){const [a,b,c,d]=period.split('|'),start=sirtaquiLocalTimestamp(a,c||'10:00'),end=sirtaquiLocalTimestamp(b||a,d||'23:59');if(start&&end&&end.slice(0,10)>=today&&new Date(end)>=new Date(start)&&add({...row,_feed:feed},sirtaquiCategories(row),start,end))count++;}}sourceReports.push({feed,selected:count});}
 const query=`[out:json][timeout:110];(nwr(around:50000,${lat},${lon})[amenity~"^(townhall|doctors|clinic|hospital|pharmacy|dentist|library|place_of_worship|supermarket|fuel|charging_station|parking|parking_space|bus_station|cafe|bar|pub)$"];nwr(around:50000,${lat},${lon})[shop];nwr(around:50000,${lat},${lon})[tourism=information];nwr(around:50000,${lat},${lon})[railway=station];nwr(around:50000,${lat},${lon})[highway=bus_stop];);out center tags;`;
 let elements=[];try{const raw=JSON.parse((await download(`osm-${key}.json`,key==='libourne'?'https://overpass-api.de/api/interpreter':'https://overpass.private.coffee/api/interpreter',{method:'POST',body:new URLSearchParams({data:query})})).toString());if(raw.remark)sourceReports.push({feed:'OpenStreetMap',warning:raw.remark});elements=raw.elements||[];}catch(e){sourceReports.push({feed:'OpenStreetMap',error:e.message});}
 const points=elements.flatMap(e=>{const t=e.tags||{},type=shopType(t),latitude=e.lat??e.center?.lat,longitude=e.lon??e.center?.lon;if(!type||!t.name||latitude==null)return [];return [{id:`osm-${e.type}-${e.id}`,type,name:t.name,latitude,longitude,address:[t['addr:housenumber'],t['addr:street'],t['addr:postcode'],t['addr:city']].filter(Boolean).join(' '),municipality:t['addr:city'],phone:t.phone||t['contact:phone'],website:t.website||t['contact:website'],sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,sourceName:'OpenStreetMap contributors (ODbL)'}];});
 for(const e of elements){const t=e.tags||{};if(!/^(cafe|bar|pub)$/.test(t.amenity||'')||!t.name)continue;const latitude=e.lat??e.center?.lat,longitude=e.lon??e.center?.lon;if(latitude==null||distanceInKm(lat,lon,latitude,longitude)>50)continue;const source=`https://www.openstreetmap.org/${e.type}/${e.id}`;entries.push({id:uuid(source),slug:uuid(source),title:t.name,city:t['addr:city']||null,address:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),latitude,longitude,start_at:'',end_at:null,is_directory_entry:true,short_description:'Café / bar. Controleer actuele openingstijden bij de aanbieder.',description:'OpenStreetMap contributors (ODbL).',source_url:source,website_url:t.website||t['contact:website']||null,contact_phone:t.phone||t['contact:phone']||null,image_url:null,category_ids:[uuid('cafes')],category_id:uuid('cafes'),status:'approved',verified:true,promotion_type:'none',promotion_status:'none'});}
 const result={key,brand:`Côte de ${key==='sarlat'?'Sarlat':'Libourne'}`,city:name,latitude:lat,longitude:lon,code_insee:code,updatedAt:new Date().toISOString(),radius:50,categories,areas,events:entries,sources:sourceReports,municipalElements:elements,shopPoints:points};
 await fs.writeFile(new URL(key+'.json',out),JSON.stringify(result));console.log(key,JSON.stringify({events:entries.length,towns:areas.length,municipalElements:elements.length,shops:points.length,coverage:Object.fromEntries(categories.map(c=>[c.slug,entries.filter(e=>e.category_ids.includes(c.id)).length]))}));
}
