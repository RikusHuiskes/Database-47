import {readFile,writeFile} from 'node:fs/promises';
import {mobilityType,mobilityTypes} from '../lib/municipal-mobility.ts';
import {distanceInKm} from '../lib/local-area.ts';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const bbox='43.85,-0.75,45.2,1.35';
const query=`[out:json][timeout:90];(nwr(${bbox})["shop"="supermarket"];nwr(${bbox})["amenity"~"^(fuel|charging_station|parking|bus_station)$"];nwr(${bbox})["amenity"="parking_space"]["parking_space"="disabled"];nwr(${bbox})["amenity"="parking_space"]["disabled"~"^(yes|designated)$"];nwr(${bbox})["highway"="bus_stop"];nwr(${bbox})["railway"~"^(station|halt|tram_stop)$"];nwr(${bbox})["public_transport"="platform"];);out center tags;`;
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
const types=['supermarket','fuel','charging','public_transport','parking','disabled_parking'];
for(const type of types)if(!elements.some(e=>mobilityTypes(e.tags??{}).includes(type)))throw Error(`Geen resultaten voor ${type}; bestaand bestand behouden.`);
await writeFile(new URL('../lib/data/municipal-mobility.json',import.meta.url),JSON.stringify({updatedAt:new Date().toISOString(),sourceName:'OpenStreetMap contributors (ODbL)',sourceUrl:'https://www.openstreetmap.org/copyright',elements}));
console.log(JSON.stringify(Object.fromEntries(types.map(type=>[type,elements.filter(e=>mobilityTypes(e.tags??{}).includes(type)).length]))));
