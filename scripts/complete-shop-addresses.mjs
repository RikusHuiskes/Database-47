import {readFile,writeFile} from 'node:fs/promises';
import {distanceInKm,normalizePlaceName as norm} from '../lib/local-area.ts';
const path=new URL('../lib/data/municipal-shops.json',import.meta.url),snapshot=JSON.parse(await readFile(path,'utf8'));
const cachePath=new URL('../work/shops/address-searches.json',import.meta.url);
let cache={};try{cache=JSON.parse(await readFile(cachePath,'utf8'));}catch{}
const missing=snapshot.points.filter(p=>!p.address&&p.id.startsWith('osm-'));
let cursor=0,completed=0,added=0,failures=0;
const nameKey=s=>norm(s).replace(/[^a-z0-9]/g,'');
const matches=(a,b)=>{a=nameKey(a);b=nameKey(b);return a.length>3&&b.length>3&&(a===b||a.includes(b)||b.includes(a));};
async function worker(){while(cursor<missing.length){
 const point=missing[cursor++],key=point.id;let result=cache[key];if(result?.error||result&&Date.now()-Date.parse(result.checkedAt)>86400000)result=undefined;
 try{
  if(!result){
   if(!point.codeInsee){const geo=await fetch(`https://geo.api.gouv.fr/communes?lat=${point.latitude}&lon=${point.longitude}&fields=nom,code,codesPostaux`,{signal:AbortSignal.timeout(15000)});if(geo.ok){const [commune]=await geo.json();if(commune){point.codeInsee=commune.code;point.municipality=commune.nom;}}}
   if(!point.codeInsee)throw Error('Gemeente niet bepaald');
   const params=new URLSearchParams({q:point.name,code_commune:point.codeInsee,per_page:'25',limite_matching_etablissements:'100'});
   let response;
   for(let attempt=0;attempt<3;attempt++){response=await fetch('https://recherche-entreprises.api.gouv.fr/search?'+params,{signal:AbortSignal.timeout(15000)});if(response.status!==429&&response.status<500)break;await new Promise(r=>setTimeout(r,1500));}
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();result={checkedAt:new Date().toISOString(),match:null};
   for(const company of data.results??[]){
    if(company.statut_diffusion!=='O'||company.opposition_diffusion_commerciale||company.etat_administratif!=='A')continue;
    for(const row of company.matching_etablissements??[]){
     const names=[row.nom_commercial,...row.liste_enseignes??[],company.nom_raison_sociale,company.nom_complet].filter(Boolean);
     if(row.etat_administratif!=='A'||row.statut_diffusion_etablissement!=='O'||row.commune!==point.codeInsee||!row.adresse||!names.some(n=>matches(n,point.name)))continue;
     if(!row.latitude||!row.longitude||distanceInKm(point.latitude,point.longitude,Number(row.latitude),Number(row.longitude))>0.15)continue;
     result.match={address:row.adresse,municipality:row.libelle_commune,codeInsee:row.commune,siret:row.siret,sourceUrl:`https://annuaire-entreprises.data.gouv.fr/etablissement/${row.siret}`,sourceName:'Annuaire des Entreprises / INSEE — SIRENE'};break;
    }if(result.match)break;
   }
   cache[key]=result;
   await new Promise(r=>setTimeout(r,450));
  }
  if(result.match){point.secondarySourceUrl=point.sourceUrl;point.secondarySourceName=point.sourceName;Object.assign(point,result.match);added++;}
 }catch(error){failures++;cache[key]={error:error.message,checkedAt:new Date().toISOString()};}
 completed++;if(completed%50===0){await writeFile(cachePath,JSON.stringify(cache));console.log(JSON.stringify({completed,total:missing.length,addressesAdded:added,failures}));}
}}
await Promise.all(Array.from({length:3},worker));
await writeFile(cachePath,JSON.stringify(cache));
await writeFile(path,JSON.stringify(snapshot));
console.log(JSON.stringify({completed,total:missing.length,addressesAdded:added,withAddress:snapshot.points.filter(p=>p.address).length,failures}));
