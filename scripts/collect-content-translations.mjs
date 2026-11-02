import fs from 'node:fs';
const content=new Set(),derived=[];
const fields=new Set(['description','short_description','details','extra','openingHours','opening_hours','serviceTimes','notes','accessibility','service_description']);
function add(s){if(typeof s==='string'&&/\p{L}/u.test(s)&&s.trim()&&!/^https?:/.test(s))content.add(s);}
function walk(x){if(Array.isArray(x))return x.forEach(walk);if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){if(fields.has(k))add(v);else if(typeof v==='object')walk(v);}}
const data=JSON.parse(fs.readFileSync('work/translations/events.json','utf8'));
for(const event of data.events){walk(event);if(!event.is_directory_entry)add(event.title);if(event.description&&event.short_description&&event.short_description.trim()!==event.description.trim()&&event.description.trim().startsWith(event.short_description.trim()))derived.push({source:event.short_description,parent:event.description});}
for(const file of fs.readdirSync('lib/data').filter(f=>/^municipal-|^mayors/.test(f)&&f.endsWith('.json')))walk(JSON.parse(fs.readFileSync('lib/data/'+file,'utf8')));
for(const file of ['municipality-health','municipality-local-services'])walk(await import('../lib/'+file+'.ts'));
fs.writeFileSync('work/translations/content-source.json',JSON.stringify([...content]));fs.writeFileSync('work/translations/content-derived.json',JSON.stringify(derived));console.log('Unique public content texts:',content.size,'derived summaries:',derived.length,'characters:',[...content].reduce((n,s)=>n+s.length,0));
