import {readFile,writeFile} from 'node:fs/promises';
import {mobilityType} from '../lib/municipal-mobility.ts';
import {distanceInKm} from '../lib/local-area.ts';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const bbox='43.85,-0.75,45.2,1.35';
const query=`[out:json][timeout:90];(nwr(${bbox})["shop"="supermarket"];nwr(${bbox})["amenity"~"^(fuel|charging_station)$"];);out center tags;`;
let result;
for(const endpoint of ['https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']) {
  try {
    const response=await fetch(`${endpoint}?${new URLSearchParams({data:query})}`,{headers:{Accept:'application/json','User-Agent':'Database47MunicipalGuide/1.0'},signal:AbortSignal.timeout(110000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    result=await response.json();if(result.remark)throw Error(result.remark);
    break;
  }catch(error){console.log(endpoint,error.message);}
}
if(!result?.elements)throw Error('Geen complete kaartgegevens opgehaald; bestaand bestand behouden.');
const elements=result.elements.filter(e=>{
  const lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;
  return mobilityType(e.tags??{}) && Number.isFinite(lat) && Number.isFinite(lon)
    && areas.some(a=>distanceInKm(a.latitude,a.longitude,lat,lon)<=a.radius_km);
});
for(const type of ['supermarket','fuel','charging'])if(!elements.some(e=>mobilityType(e.tags??{})===type))throw Error(`Geen resultaten voor ${type}; bestaand bestand behouden.`);
await writeFile(new URL('../lib/data/municipal-mobility.json',import.meta.url),JSON.stringify({updatedAt:new Date().toISOString(),sourceName:'OpenStreetMap contributors (ODbL)',sourceUrl:'https://www.openstreetmap.org/copyright',elements}));
console.log(JSON.stringify(Object.fromEntries(['supermarket','fuel','charging'].map(type=>[type,elements.filter(e=>mobilityType(e.tags??{})===type).length]))));
