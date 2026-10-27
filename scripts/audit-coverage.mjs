import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(await readFile(new URL('../lib/local-area.ts',import.meta.url),'utf8'));
const {distanceInKm}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const load=async name=>JSON.parse(await readFile(new URL('../lib/data/'+name,import.meta.url),'utf8'));
const {areas}=await load('area-catalog.json');
const {events,updatedAt}=await load('sirtaqui-events.json');
const categories=['festivals-fetes','marches-brocantes','concerts-musique','theatre-spectacles','restaurants-gastronomie','sport','culture-musees','nature-randonnee','enfants-famille','art-expositions','ateliers-cours','vie-locale'];
const cells=areas.flatMap(area=>categories.map(category=>{
 const matches=events.filter(event=>(event.category_slugs ?? [event.category_slug]).includes(category) && distanceInKm(area.latitude,area.longitude,event.latitude,event.longitude)<=area.radius_km);
 return {city:area.name,radiusKm:area.radius_km,category,count:matches.length,examples:matches.slice(0,3).map(event=>({title:event.title,city:event.city,date:event.start_at,source:event.source_url}))};
}));
const report={checkedAt:new Date().toISOString(),sourceUpdatedAt:updatedAt,towns:areas.length,categories:categories.length,checks:cells.length,withResults:cells.filter(cell=>cell.count).length,missing:cells.filter(cell=>!cell.count),cells};
await mkdir(new URL('../work/',import.meta.url),{recursive:true});
await writeFile(new URL('../work/event-coverage.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({towns:report.towns,checks:report.checks,withResults:report.withResults,missing:report.missing}));
