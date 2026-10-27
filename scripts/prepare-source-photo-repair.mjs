import {readFile,writeFile} from 'node:fs/promises';
import {parseSirtaquiCsv,sirtaquiPhotoUrl} from '../lib/sirtaqui.ts';

const photos=new Map();
for(const department of ['24','33','47']) {
 const bytes=await readFile(new URL(`../work/agenda-${department}.csv`,import.meta.url));
 for(const row of parseSirtaquiCsv(new TextDecoder('windows-1252').decode(bytes))) {
  const url=sirtaquiPhotoUrl(row.PHOTOS);
  if(url)photos.set(row['IDENTIFIANT SIRTAQUI'],url);
 }
}
const snapshotPath=new URL('../lib/data/sirtaqui-events.json',import.meta.url);
const snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
for(const event of snapshot.events)if(!event.image_url)event.image_url=photos.get(event.source_id)||null;
await writeFile(snapshotPath,JSON.stringify(snapshot));
const national=JSON.parse(await readFile(new URL('../lib/data/openagenda-events.json',import.meta.url),'utf8'));
const patches=[...snapshot.events,...national.events].filter(e=>e.image_url).map(e=>({source_url:e.source_url,image_url:e.image_url}));
await writeFile(new URL('../work/source-photo-repair.json',import.meta.url),JSON.stringify(patches));
console.log(JSON.stringify({regional:snapshot.events.length,regionalWithPhotos:snapshot.events.filter(e=>e.image_url).length,nationalWithPhotos:national.events.filter(e=>e.image_url).length,patches:patches.length}));
