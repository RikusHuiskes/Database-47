import {readFile,writeFile} from 'node:fs/promises';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const types=['mairie','doctor','hospital','library','pharmacy','church','tourism','dentist'];
const cells=[]; let cursor=0;
async function worker(){while(cursor<areas.length){const area=areas[cursor++];
 const params=new URLSearchParams({city:area.name,lat:String(area.latitude),lon:String(area.longitude),codeInsee:area.code_insee,service:'all'});
 try{
  const response=await fetch(`http://127.0.0.1:3000/api/municipality-services?${params}`,{signal:AbortSignal.timeout(55000)});
  const data=await response.json();
  for(const type of types){const entries=(data.services??[]).filter(entry=>entry.type===type);
   cells.push({city:area.name,type,count:entries.length,withAddress:entries.filter(entry=>entry.address).length,withPhone:entries.filter(entry=>entry.phone).length,examples:entries.slice(0,3),status:response.status});
  }
  console.log(area.name,response.status,types.filter(type=>!data.services?.some(entry=>entry.type===type)).join(',')||'complete');
 }catch(error){for(const type of types)cells.push({city:area.name,type,count:0,error:error.message});console.log(area.name,error.message);}
}}
await Promise.all(Array.from({length:3},worker));
const report={checkedAt:new Date().toISOString(),towns:areas.length,checks:cells.length,withResults:cells.filter(cell=>cell.count).length,missing:cells.filter(cell=>!cell.count),cells};
await writeFile(new URL('../work/municipal-coverage.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.checks,withResults:report.withResults,missing:report.missing}));
