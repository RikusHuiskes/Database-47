import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=new URL('../',import.meta.url),cache=new URL('work/photo-audit/',root);
const found=JSON.parse(await fs.readFile(new URL('provider-photos.json',cache),'utf8')).filter(e=>!/construction|Instagram|Facebook|Linktree/i.test(e.evidence_title)&&!/(fbcdn|cdninstagram|linktr.ee)/.test(e.image_url)&&!e.title.startsWith('Suditi divine home'));
const accepted=[];
for(const e of found){try{
 const r=await fetch(e.image_url,{signal:AbortSignal.timeout(20000)});if(!r.ok)continue;
 const bytes=Buffer.from(await r.arrayBuffer()),info=await sharp(bytes).metadata();if(info.width<300||info.height<160)continue;
 const folder=new URL(`public/regions/${e.key}/photos/`,root);await fs.mkdir(folder,{recursive:true});
 await sharp(bytes).rotate().resize({width:1200,height:900,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(fileURLToPath(new URL(e.id+'.webp',folder)));
 accepted.push({...e,original_image_url:e.image_url,image_url:`https://cote-de-${e.key}.vercel.app/regions/${e.key}/photos/${e.id}.webp`});console.log('Provider photo saved',e.key,e.title);
 }catch(err){console.log('Provider photo unavailable',e.title,err.message);}}
await fs.writeFile(new URL('accepted-provider-photos.json',cache),JSON.stringify(accepted,null,2));
