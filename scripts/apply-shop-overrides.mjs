import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../lib/data/municipal-shops.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
const overrides=JSON.parse(await readFile(new URL('../lib/data/municipal-shop-overrides.json',import.meta.url),'utf8'));
for(const update of overrides.updates){const point=data.points.find(p=>p.id===update.id);if(point)Object.assign(point,update.fields);}
data.points=data.points.filter(p=>!overrides.exclusions.some(e=>e.id===p.id&&e.name.toLowerCase()===p.name.toLowerCase()));
const seen=new Map();const unique=[];
for(const point of data.points){const key=point.siret?point.type+':'+point.siret:point.id;const previous=seen.get(key);if(previous){const id=previous.id;Object.assign(previous,Object.fromEntries(Object.entries(point).filter(([,value])=>value!=null&&value!=='')),{id});}else{seen.set(key,point);unique.push(point);}}
data.points=unique;
data.exclusions=overrides.exclusions;
await writeFile(file,JSON.stringify(data));
