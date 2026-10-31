import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseSirtaquiCsv,sirtaquiPhotoUrl} from '../lib/sirtaqui.ts';
import {distanceInKm,normalizePlaceName} from '../lib/local-area.ts';

const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const cache=new URL('../work/directory-sources/',import.meta.url);
await mkdir(cache,{recursive:true});
import {DIRECTORY_FEEDS as feeds} from '../lib/directory-feeds.ts';
const entries=[],sources=[];
async function download(name,url,options={}) {
  const path=new URL(name,cache);
  try{return await readFile(path);}catch{}
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw Error(`${r.status} ${url}`);
  const data=Buffer.from(await r.arrayBuffer());await writeFile(path,data);return data;
}
const norm=normalizePlaceName;
const relevant=(lat,lon,city)=>areas.some(a=>norm(a.name)===norm(city)||Number.isFinite(lat)&&Number.isFinite(lon)&&distanceInKm(a.latitude,a.longitude,lat,lon)<=a.radius_km);
for(const [feed,category_slug] of feeds){
  const url=`https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-${feed}.csv`;
  try{
    const rows=parseSirtaquiCsv(new TextDecoder('windows-1252').decode(await download(`${feed}.csv`,url)));
    let selected=0;
    for(const r of rows){
      if(category_slug==='restaurants-gastronomie'&&!/restaurant|restauration|brasserie|pizzeria|creperie|ferme auberge|bistrot|traiteur/.test(norm(`${r.NOM_OFFRE} ${r.TYPE??''} ${r.CATEGORIE??''}`)))continue;
      if(category_slug==='cafes'&&!/\b(cafe|bar|pub|bistrot|salon de the)\b/.test(norm(`${r.NOM_OFFRE} ${r.TYPE??''} ${r.CATEGORIE??''}`)))continue;
      const lat=r.LATITUDE?Number(r.LATITUDE):NaN,lon=r.LONGITUDE?Number(r.LONGITUDE):NaN;
      if(!r.NOM_OFFRE||!r['IDENTIFIANT SIRTAQUI']||!relevant(lat,lon,r.COMMUNE))continue;
      entries.push({source_id:r['IDENTIFIANT SIRTAQUI'],category_slug,title:r.NOM_OFFRE,city:r.COMMUNE,postcode:r.CODE_POSTAL||null,address:[r.BATIMENT_RESIDENCE,r.RUE,r.LIEUDIT_BP,r.ADRESSE].filter(Boolean).join(', ')||null,
        latitude:Number.isFinite(lat)?lat:null,longitude:Number.isFinite(lon)?lon:null,
        short_description:r.DESCRIPTIF?.slice(0,250)||null,description:[r.DESCRIPTIF,`Bron: SIRTAQUI — CRT Nouvelle-Aquitaine. Bron bijgewerkt: ${r.DATE_DERNIERE_MAJ||'niet vermeld'}.`].filter(Boolean).join('\n\n'),
        website_url:r.SITE_WEB?.split(' # ')[0]||null,contact_phone:r.TEL?.split(' # ')[0]||null,image_url:sirtaquiPhotoUrl(r.PHOTOS),source_url:`${url}#${r['IDENTIFIANT SIRTAQUI']}`,source_updated_at:r.DATE_DERNIERE_MAJ||null});
      selected++;
    }
    sources.push({url,total:rows.length,selected});console.log(JSON.stringify(sources.at(-1)));
  }catch(e){sources.push({url,error:e.message});console.log(e.message);}
}
const query='[out:json][timeout:120];nwr(43.85,-0.75,45.2,1.35)[amenity~"^(cafe|bar|pub)$"];out center tags;';
for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
  try{
    const osm=JSON.parse((await download('cafes.json',endpoint,{method:'POST',body:new URLSearchParams({data:query})})).toString());
    if(osm.remark)throw Error(osm.remark);
    for(const r of osm.elements??[]){const t=r.tags??{},lat=r.lat??r.center?.lat,lon=r.lon??r.center?.lon;
      if(!t.name||t.disused==='yes'||t.access==='private'||!Number.isFinite(lat)||!relevant(lat,lon,t['addr:city']??''))continue;
      // A town is only assigned from the source's address, never from proximity.
      entries.push({source_id:`osm-${r.type}-${r.id}`,category_slug:'cafes',title:t.name,city:t['addr:city']||null,postcode:t['addr:postcode']||null,address:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' ')||null,
        latitude:lat,longitude:lon,short_description:`${t.amenity==='cafe'?'Café':t.amenity==='pub'?'Pub':'Bar'}. Raadpleeg de website voor actuele openingstijden.`,description:'Bron: OpenStreetMap-bijdragers (ODbL). Gemeente en adres worden alleen overgenomen wanneer de bron ze vermeldt.',
        website_url:t.website||t['contact:website']||null,contact_phone:t.phone||t['contact:phone']||null,image_url:/^https:\/\//.test(t.image??'')?t.image:null,source_url:`https://www.openstreetmap.org/${r.type}/${r.id}`});
    }
    sources.push({url:endpoint,query,total:osm.elements.length});break;
  }catch(e){sources.push({url:endpoint,error:e.message});}
}
const unique=[];
for(const e of entries){
  const duplicate=unique.find(x=>x.category_slug===e.category_slug&&(x.source_id===e.source_id||norm(x.title)===norm(e.title)&&norm(x.city??'')===norm(e.city??'')&&(!x.latitude||!e.latitude||distanceInKm(x.latitude,x.longitude,e.latitude,e.longitude)<0.3)));
  if(duplicate){if(!duplicate.image_url)duplicate.image_url=e.image_url;continue;}unique.push(e);
}
const categories=[...new Set(feeds.map(([,category])=>category))];
const coverage=areas.map(a=>({municipality:a.name,...Object.fromEntries(categories.map(c=>[c,{inMunicipality:unique.filter(e=>e.category_slug===c&&e.city&&norm(e.city)===norm(a.name)).length,withinRadius:unique.filter(e=>e.category_slug===c&&e.latitude!=null&&distanceInKm(a.latitude,a.longitude,e.latitude,e.longitude)<=a.radius_km).length,radiusKm:a.radius_km}]))}));
await writeFile(new URL('../lib/data/directory-entries.json',import.meta.url),JSON.stringify({updatedAt:new Date().toISOString(),sources,entries:unique}));
await writeFile(new URL('../work/directory-coverage.json',import.meta.url),JSON.stringify(coverage,null,2));
console.log(JSON.stringify({total:unique.length,categories:Object.fromEntries(categories.map(c=>[c,unique.filter(e=>e.category_slug===c).length])),coverage:coverage.filter(a=>norm(a.municipality)==='bergerac')}));
