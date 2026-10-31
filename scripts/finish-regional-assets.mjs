import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);await fs.mkdir(new URL('public/regions/',root),{recursive:true});
for(const key of ['libourne','sarlat']){const file=new URL(`lib/regions/${key}.json`,root),d=JSON.parse(await fs.readFile(file,'utf8'));
 const match=d.events.find(e=>e.title===(key==='libourne'?'Bastide de Libourne':'Sarlat-la-Caneda')&&e.image_url);if(!match)throw Error('Regional hero source missing');
 const r=await fetch(match.image_url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Image HTTP '+r.status);await fs.writeFile(new URL(`public/regions/${key}.jpg`,root),Buffer.from(await r.arrayBuffer()));
 d.hero={title:match.title,image:match.image_url,source:match.source_url,localPath:`/regions/${key}.jpg`};
 const counts=new Map;for(const a of d.areas)counts.set(a.id,(counts.get(a.id)||0)+1);for(const a of d.areas)if(counts.get(a.id)>1)a.id+='-'+a.code_insee;
 await fs.writeFile(file,JSON.stringify(d));console.log(key,d.hero.title,d.hero.localPath);
}
