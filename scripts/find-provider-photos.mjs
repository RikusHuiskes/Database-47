import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),cache=new URL('work/photo-audit/',root);
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/&amp;/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const generic=new Set('hotel hotels restaurant chambre chambres hote hotes gite gites location vacances maison monsieur madame domaine chateau camping residence appartement bienvenue accueil officiel site sarlat libourne bordeaux'.split(' '));
const eligible=[];
for(const key of ['libourne','sarlat']){const d=JSON.parse(await fs.readFile(new URL(`lib/regions/${key}.json`,root),'utf8'));for(const e of d.events)if(!e.image_url&&e.website_url&&e.is_directory_entry)eligible.push({...e,key});}
const pages=new Map();for(const e of eligible){try{const u=new URL(e.website_url);if(!/^https?:$/.test(u.protocol)||!u.hostname.includes('.')||/^(localhost|127\.|192\.168\.|10\.)/.test(u.hostname))continue;u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid)/.test(k))u.searchParams.delete(k);const url=u.href;if(!pages.has(url))pages.set(url,[]);pages.get(url).push(e);}catch{}}
const jobs=[...pages],found=[];let cursor=0,done=0;
await Promise.all(Array.from({length:8},async()=>{while(cursor<jobs.length){const [url,events]=jobs[cursor++];try{
 const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))continue;
 const html=(await r.text()).slice(0,2_000_000),meta={};
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1].toLowerCase()]=m[2]??m[3];const name=attrs.property||attrs.name;if(name&&attrs.content)meta[name.toLowerCase()]=attrs.content;}
 const title=meta['og:title']||html.match(/<title[^>]*>([^<]*)/i)?.[1]||'';
 const raw=meta['og:image:secure_url']||meta['og:image'];if(!raw)continue;
 const image=new URL(raw.replaceAll('&amp;','&'),r.url);if(image.protocol!=='https:'||/logo|favicon|placeholder|default[-_]?image/i.test(image.pathname))continue;
 const matches=events.filter(e=>{const words=[...new Set(normalize(e.title).split(' ').filter(w=>w.length>=4&&!generic.has(w)))];const normalized=normalize(title);return words.length>0&&words.filter(w=>normalized.split(' ').includes(w)).length/words.length>=.67;});if(!matches.length)continue;
 const photo=await fetch(image,{method:'HEAD',signal:AbortSignal.timeout(10000)});if(!photo.ok||!photo.headers.get('content-type')?.startsWith('image/'))continue;
 for(const e of matches)found.push({key:e.key,id:e.id,title:e.title,image_url:image.href,photo_source_url:r.url,evidence_title:title,checkedAt:new Date().toISOString()});
 }catch{}finally{done++;if(done%25===0){console.log('Provider pages',done,'/',jobs.length,'matching photos',found.length);await fs.writeFile(new URL('provider-photos.json',cache),JSON.stringify(found,null,2));}}}}));
await fs.writeFile(new URL('provider-photos.json',cache),JSON.stringify(found,null,2));console.log('Provider photo result',found.length);
