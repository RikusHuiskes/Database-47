import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {SHOP_NAF_CODES,SHOP_TYPES,shopNafType,shopType} from '../lib/municipal-shops.ts';
import {distanceInKm,normalizePlaceName as norm} from '../lib/local-area.ts';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
await mkdir(new URL('../work/shops/',import.meta.url),{recursive:true});
const points=[],searches=[];
async function official(area){
 let page=1,pages=1,found=0;
 do{
  const params=new URLSearchParams({code_commune:area.code_insee,activite_principale:SHOP_NAF_CODES.join(','),etat_administratif:'A',per_page:'25',limite_matching_etablissements:'100',page:String(page)});
  const url='https://recherche-entreprises.api.gouv.fr/search?'+params;
  let data;
  for(let attempt=0;attempt<4;attempt++){
   const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
   if(response.status===429||response.status>=500){await new Promise(r=>setTimeout(r,1200*(attempt+1)));continue;}
   if(!response.ok)throw Error(`${area.name}: HTTP ${response.status}`);
   data=await response.json();break;
  }
  if(!data?.results)throw Error(`${area.name}: geen volledig antwoord`);
  pages=data.total_pages;
  for(const company of data.results){
   if(company.statut_diffusion!=='O'||company.opposition_diffusion_commerciale)continue;
   for(const row of company.matching_etablissements??[]){
    if(row.commune!==area.code_insee||row.etat_administratif!=='A'||row.statut_diffusion_etablissement!=='O')continue;
    const name=row.nom_commercial||row.liste_enseignes?.[0]||company.nom_raison_sociale||company.nom_complet;
    const type=shopNafType(row.activite_principale,name);if(!type)continue;
    const latitude=row.latitude?Number(row.latitude):null,longitude=row.longitude?Number(row.longitude):null;
    points.push({id:`sirene-${row.siret}`,type,name,address:row.adresse||undefined,municipality:row.libelle_commune||area.name,codeInsee:row.commune,postcode:row.code_postal,siret:row.siret,latitude,longitude,sourceUrl:`https://annuaire-entreprises.data.gouv.fr/etablissement/${row.siret}`,sourceName:'Annuaire des Entreprises / INSEE — SIRENE',extra:'Actieve vestiging volgens het officiële bedrijvenregister. Controleer openingstijden en bezoekmogelijkheden bij de winkel.'});found++;
   }
  }
  await new Promise(r=>setTimeout(r,350));page++;
 }while(page<=pages);
 searches.push({city:area.name,codeInsee:area.code_insee,pages,found});console.log(JSON.stringify(searches.at(-1)));
}
const officialCache=new URL('../work/shops/official.json',import.meta.url);
try{const cached=JSON.parse(await readFile(officialCache,'utf8'));if(Date.now()-Date.parse(cached.updatedAt)>86400000)throw Error('Nieuwe controle vereist');points.push(...cached.points);searches.push(...cached.searches);console.log('Officiële adrescontrole uit deze werkronde hergebruikt.');}catch{let cursor=0;await Promise.all(Array.from({length:2},async()=>{while(cursor<areas.length)await official(areas[cursor++]);}));await writeFile(officialCache,JSON.stringify({updatedAt:new Date().toISOString(),points,searches}));}
const query='[out:json][timeout:90];nwr(43.85,-0.75,45.2,1.35)[shop~"^(bakery|butcher|tobacco|kiosk|newsagent|gift|souvenir|shoes|florist|clothes|fashion|boutique|hardware|doityourself|jewelry|hairdresser)$"];out center tags;';
let osm;
for(const endpoint of ['https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
 try{const r=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{headers:{Accept:'application/json','User-Agent':'Database47MunicipalGuide/1.0'},signal:AbortSignal.timeout(110000)});if(!r.ok)throw Error('HTTP '+r.status);const result=await r.json();if(result.remark)throw Error(result.remark);osm=result;break;}catch(error){console.log(error.message);}
}
if(!osm?.elements)throw Error('Geen volledige winkelkaart ontvangen; snapshot behouden.');
await writeFile(new URL('../work/shops/osm.json',import.meta.url),JSON.stringify(osm));
for(const row of osm.elements){
 const tags=row.tags??{},type=shopType(tags),name=tags.name||tags['name:fr']||tags.brand,latitude=row.lat??row.center?.lat,longitude=row.lon??row.center?.lon;
 if(!type||!name||!Number.isFinite(latitude)||!Number.isFinite(longitude)||!areas.some(a=>distanceInKm(a.latitude,a.longitude,latitude,longitude)<=a.radius_km))continue;
 const same=points.find(p=>p.type===type&&(tags['ref:FR:SIRET']&&tags['ref:FR:SIRET']===p.siret||Number.isFinite(p.latitude)&&distanceInKm(latitude,longitude,p.latitude,p.longitude)<0.15&&(norm(name)===norm(p.name)||norm(p.name).includes(norm(name))||norm(name).includes(norm(p.name)))));
 const details={phone:tags.phone||tags['contact:phone'],website:tags.website||tags['contact:website'],email:tags.email||tags['contact:email'],openingHours:tags.opening_hours};
 if(same){Object.assign(same,Object.fromEntries(Object.entries(details).filter(([,v])=>v)));continue;}
 points.push({id:`osm-${row.type}-${row.id}`,type,name,latitude,longitude,address:[tags['addr:housenumber'],tags['addr:street']||tags['addr:place'],tags['addr:postcode'],tags['addr:city']].filter(Boolean).join(' ')||undefined,municipality:tags['addr:city']||tags['addr:place'],...details,sourceUrl:`https://www.openstreetmap.org/${row.type}/${row.id}`,sourceName:'OpenStreetMap contributors (ODbL)'});
}
const unique=[...new Map(points.map(p=>[p.id,p])).values()];
const report=areas.map(a=>({city:a.name,...Object.fromEntries(SHOP_TYPES.map(type=>{const local=unique.filter(p=>p.type===type&&(p.codeInsee===a.code_insee||norm(p.municipality??'')===norm(a.name)));const nearby=unique.filter(p=>p.type===type&&Number.isFinite(p.latitude)&&distanceInKm(a.latitude,a.longitude,p.latitude,p.longitude)<=a.radius_km);return[type,{local:local.length,localWithAddress:local.filter(p=>p.address).length,withinRadius:nearby.length}];}))}));
await writeFile(new URL('../lib/data/municipal-shops.json',import.meta.url),JSON.stringify({updatedAt:new Date().toISOString(),points:unique,searches}));
await writeFile(new URL('../work/shops/coverage.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({points:unique.length,withAddress:unique.filter(p=>p.address).length,byType:Object.fromEntries(SHOP_TYPES.map(t=>[t,unique.filter(p=>p.type===t).length])),missing:report.flatMap(r=>SHOP_TYPES.filter(t=>!r[t].withinRadius).map(type=>({city:r.city,type})))}));

await import('./enrich-shop-municipalities.mjs');
await import('./complete-shop-addresses.mjs');
await import('./apply-shop-overrides.mjs');
