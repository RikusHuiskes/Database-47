import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { parseSirtaquiCsv, sirtaquiLocalTimestamp, sirtaquiCategory, sirtaquiCategories, sirtaquiPhotoUrl } from '../lib/sirtaqui.ts';

const areaCode = stripTypeScriptTypes(await readFile(new URL('../lib/local-area.ts', import.meta.url), 'utf8'));
const { LOCAL_AREA_TOWNS, VISITOR_EVENT_CITY_GROUPS, normalizePlaceName, distanceInKm } = await import('data:text/javascript;base64,' + Buffer.from(areaCode).toString('base64'));
const dataDir = new URL('../lib/data/', import.meta.url);
const cacheDir = new URL('../work/source-data/', import.meta.url);
await mkdir(dataDir, { recursive: true }); await mkdir(cacheDir, { recursive: true });
const jsonFile = async (name, data) => writeFile(new URL(name, dataDir), JSON.stringify(data));
async function cached(name, url, options = {}) {
  const file = new URL(name, cacheDir);
  try { return await readFile(file); } catch {}
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(90_000), headers: { 'user-agent': 'Database47Directory/1.0', ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(file, bytes);
  return bytes;
}
const date = new Date().toISOString();
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const communes = (await Promise.all(['24','33','47'].map(async department => {
  const params = new URLSearchParams({ codeDepartement: department, fields: 'nom,code,codesPostaux', format: 'geojson', geometry: 'centre' });
  const bytes = await cached(`communes-${department}.json`, `https://geo.api.gouv.fr/communes?${params}`);
  return JSON.parse(bytes.toString()).features;
}))).flat();
const names = [...new Set([...VISITOR_EVENT_CITY_GROUPS.flatMap(group => group.cities), ...LOCAL_AREA_TOWNS.map(area => area.name)])];
const areas = names.map(name => {
  const normalized = normalizePlaceName(name === 'Beaumont-du-Périgord' ? 'Beaumontois en Périgord' : name);
  const found = communes.filter(feature => normalizePlaceName(feature.properties.nom) === normalized)
    .sort((a,b) => distanceInKm(44.6764,0.1837,a.geometry.coordinates[1],a.geometry.coordinates[0]) - distanceInKm(44.6764,0.1837,b.geometry.coordinates[1],b.geometry.coordinates[0]))[0];
  if (!found) throw new Error(`No commune coordinates: ${name}`);
  const [longitude, latitude] = found.geometry.coordinates;
  return { id: normalizePlaceName(name).replace(/ /g,'-'), name, postcode: found.properties.codesPostaux[0], code_insee: found.properties.code, latitude, longitude, radius_km: ['agen','bergerac'].includes(normalizePlaceName(name)) ? 10 : 25, distance_group: VISITOR_EVENT_CITY_GROUPS.find(group => group.cities.includes(name))?.label ?? 'Overige plaatsen' };
});
await jsonFile('area-catalog.json', { updatedAt: date, source: 'https://geo.api.gouv.fr/communes', areas });
await jsonFile('commune-centres.json', communes.map(feature=>({ name:feature.properties.nom, code:feature.properties.code, postcode:feature.properties.codesPostaux?.[0], longitude:feature.geometry.coordinates[0], latitude:feature.geometry.coordinates[1] })));
console.log('Resolved areas:', areas.length);

const allEvents = [];
const sourceReports = [];
for (const department of ['24','33','47']) {
  const sourceUrl = `https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-${department}.csv`;
  const bytes = await cached(`agenda-${department}.csv`, sourceUrl);
  const rows = parseSirtaquiCsv(new TextDecoder('windows-1252').decode(bytes));
  let relevant = 0;
  for (const row of rows) {
    const latitude = Number(row.LATITUDE), longitude = Number(row.LONGITUDE);
    if (!row.LATITUDE || !row.LONGITUDE || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (!areas.some(area => distanceInKm(area.latitude, area.longitude, latitude, longitude) <= area.radius_km)) continue;
    const id = row['IDENTIFIANT SIRTAQUI'];
    for (const period of row.DATES.split(/\s+#\s+/)) {
      const [startDate, endDate, from, until] = period.split('|');
      const start_at = sirtaquiLocalTimestamp(startDate, from || '10:00');
      const end_at = sirtaquiLocalTimestamp(endDate || startDate, until || '23:59');
      if (!start_at || !end_at || new Date(end_at) < new Date(start_at) || end_at.slice(0,10) < today) continue;
      const category_slug = sirtaquiCategory(row);
      const slug = `${row.NOM_OFFRE}-${start_at.slice(0,10)}-${id}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      allEvents.push({ source_id: id, category_slug, category_slugs: sirtaquiCategories(row), title: row.NOM_OFFRE, slug, short_description: row.DESCRIPTIF.slice(0,250) || null, description: `${row.DESCRIPTIF || ''}\n\nBron: SIRTAQUI — CRT Nouvelle-Aquitaine. Bron bijgewerkt: ${row.DATE_DERNIERE_MAJ || 'niet vermeld'}.`.trim(),
        start_at, end_at, venue_name: row.LIEU || null, address: row.ADRESSE || null, postcode: row.CODE_POSTAL, city: row.COMMUNE, latitude, longitude,
        price_from: null, price_to: null, is_free: /^gratuit\b/i.test(row.TARIFS), tariff_text: row.TARIFS || null,
        website_url: row.SITE_WEB.split(' # ')[0] || null, booking_url: null, contact_phone: row.TEL || null, image_url: sirtaquiPhotoUrl(row.PHOTOS), organizer_name: row.ORGANISATEUR || null,
        source_category: row.CATEGORIE || row.TYPE, source_url: `${sourceUrl}#${id}-${start_at.slice(0,10)}`, source_updated_at: row.DATE_DERNIERE_MAJ, status:'pending', verified:false });
      relevant++;
    }
  }
  sourceReports.push({ department, sourceUrl, records: rows.length, relevant });
  console.log('Agenda:', department, rows.length, 'records,', relevant, 'future nearby periods');
}
const unique = [...new Map(allEvents.map(event => [event.source_url,event])).values()];
await jsonFile('sirtaqui-events.json', { updatedAt: date, sourceName: 'SIRTAQUI — CRT Nouvelle-Aquitaine', sources: sourceReports, events: unique });
console.log('Unique events:', unique.length);

const bbox = '43.85,-0.75,45.2,1.35';
const query = `[out:json][timeout:90];(nwr(${bbox})["amenity"~"^(townhall|doctors|clinic|hospital|pharmacy|dentist|library|place_of_worship)$"];nwr(${bbox})["healthcare"~"^(doctor|clinic|hospital|pharmacy|dentist)$"];nwr(${bbox})["tourism"="information"]["information"~"^(office|tourist_information)$"];);out center tags;`;
let osm;
for (const [index, endpoint] of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'].entries()) {
  try { osm = JSON.parse((await cached('municipal-osm.json', endpoint, {method:'POST',body:new URLSearchParams({data:query})})).toString()); if (osm.remark) throw new Error(osm.remark); break; }
  catch (error) { console.log('Map source:', error.message); if(index===1) throw error; }
}
await jsonFile('municipal-osm.json',{ updatedAt:date, sourceName:'OpenStreetMap contributors (ODbL)', sourceUrl:'https://www.openstreetmap.org/copyright', elements:osm.elements });
console.log('Municipal map records:', osm.elements.length);

const official = [];
for (let offset=0;offset<areas.length;offset+=15) {
  const codes = areas.slice(offset,offset+15).map(area=>`"${area.code_insee}"`).join(',');
  const params = new URLSearchParams({ where:`code_insee_commune in (${codes})`, limit:'100' });
  const url=`https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?${params}`;
  try { const result=JSON.parse((await cached(`directory-${offset}.json`,url)).toString()); official.push(...(result.results??[])); }
  catch(error){ console.log('Official directory:',error.message); }
}
await jsonFile('municipal-official.json',{updatedAt:date,sourceName:'Service-Public.gouv.fr / DILA',records:official});
console.log('Official directory records:',official.length);
