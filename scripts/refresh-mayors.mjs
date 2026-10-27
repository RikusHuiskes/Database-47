import {readFile,writeFile} from 'node:fs/promises';
import {parseSirtaquiCsv} from '../lib/sirtaqui.ts';
const metadata=await fetch('https://www.data.gouv.fr/api/1/datasets/repertoire-national-des-elus-1/').then(response=>response.json());
const resource=metadata.resources.find(resource=>/maires?/i.test(resource.title)&&resource.format==='csv');
if(!resource)throw new Error('Official mayor file not found');
const response=await fetch(resource.url,{signal:AbortSignal.timeout(60000)});
if(!response.ok)throw new Error('Official mayor register unavailable');
const rows=parseSirtaquiCsv(await response.text());
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const codes=new Set(areas.map(area=>area.code_insee));
const mayors=rows.filter(row=>codes.has(row['Code de la commune'])).map(row=>({code:row['Code de la commune'],city:row['Libellé de la commune'],name:[row["Prénom de l'élu"],row["Nom de l'élu"]].filter(Boolean).join(' '),mandateStart:row['Date de début du mandat'],functionStart:row['Date de début de la fonction']}));
// The national snapshot omits this commune after a change of mayor. The
// departmental mayors' association publishes the successor and current contacts.
if(!mayors.some(mayor=>mayor.code==='47018'))mayors.push({code:'47018',city:'Auriac-sur-Dropt',name:'Jannick ORJUBIN',sourceUrl:'https://adm47.asso.fr/auriac-sur-dropt/',sourceName:'Association des Maires de Lot-et-Garonne — maire depuis 2026'});
await writeFile(new URL('../lib/data/mayors.json',import.meta.url),JSON.stringify({sourceUrl:resource.url,sourceName:'Répertoire national des élus — Ministère de l’Intérieur',sourceUpdatedAt:resource.last_modified,mayors}));
console.log(JSON.stringify({mayors:mayors.length,missing:areas.filter(area=>!mayors.some(mayor=>mayor.code===area.code_insee)).map(area=>area.name)}));
