import {readFile,writeFile} from 'node:fs/promises';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:3048';
const tasks=areas.flatMap(area=>['public_transport','parking','disabled_parking'].map(service=>({area,service})));
const results=[];let cursor=0;
async function worker(){while(cursor<tasks.length){
  const {area,service}=tasks[cursor++];
  const params=new URLSearchParams({city:area.name,lat:String(area.latitude),lon:String(area.longitude),codeInsee:area.code_insee,service});
  try{
    const response=await fetch(`${base}/api/municipality-services?${params}`,{signal:AbortSignal.timeout(45000)});
    const data=await response.json(),rows=data.services??[];
    const correct=response.ok&&rows.length>0&&rows.every(row=>row.type===service&&row.sourceUrl?.startsWith('https://www.openstreetmap.org/')&&Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&row.distanceKm<=data.radiusKm);
    results.push({city:area.name,service,status:response.status,count:rows.length,radiusKm:data.radiusKm,correct,first:rows[0]?.name});
  }catch(error){results.push({city:area.name,service,correct:false,error:error.message});}
}}
await Promise.all(Array.from({length:4},worker));
const report={checkedAt:new Date().toISOString(),municipalities:areas.length,checks:results.length,passed:results.filter(row=>row.correct).length,failures:results.filter(row=>!row.correct),results};
await writeFile(new URL('../work/transport-parking-audit.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined}));
if(report.failures.length)process.exitCode=1;
