import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../lib/data/municipal-shops.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
const overrides=JSON.parse(await readFile(new URL('../lib/data/municipal-shop-overrides.json',import.meta.url),'utf8'));
for(const update of overrides.updates){const point=data.points.find(p=>p.id===update.id);if(point)Object.assign(point,update.fields);}
data.points=data.points.filter(p=>!overrides.exclusions.some(e=>e.id===p.id&&e.name.toLowerCase()===p.name.toLowerCase()));
data.exclusions=overrides.exclusions;
await writeFile(file,JSON.stringify(data));
