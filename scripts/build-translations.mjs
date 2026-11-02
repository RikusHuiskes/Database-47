import fs from 'node:fs';import {createHash} from 'node:crypto';
import {protectedNames} from './protected-translation-names.mjs';
import {localizeOpeningHours} from '../lib/i18n.ts';
const normalize=s=>s.replace(/\s+/g,' ').trim();
function key(text){let hash=BigInt('14695981039346656037');for(const byte of new TextEncoder().encode(normalize(text))){hash^=BigInt(byte);hash=BigInt.asUintN(64,hash*BigInt('1099511628211'));}return hash.toString(16).padStart(16,'0');}
const reviewed=fs.readdirSync('app/i18n/messages').filter(file=>/^reviewed(?:-.*)?\.json$/.test(file)).sort((a,b)=>a==='reviewed.json'?-1:b==='reviewed.json'?1:a.localeCompare(b)).flatMap(file=>JSON.parse(fs.readFileSync('app/i18n/messages/'+file,'utf8')));
const protectedValues=protectedNames(),reviewedKeys=new Set(reviewed.map(row=>normalize(row[0])));
const report={generatedAt:new Date().toISOString(),ui:{},content:{}};
for(const mode of ['ui','content']){
 const sources=JSON.parse(fs.readFileSync(`work/translations/${mode}-source.json`,'utf8'));
 const cache=JSON.parse(fs.readFileSync(`work/translations/${mode}-cache.json`,'utf8'));
 const allowed=new Set(sources.map(normalize));
 if(mode==='content')for(const entry of JSON.parse(fs.readFileSync('work/translations/content-derived.json','utf8'))){const parent=cache[normalize(entry.parent)];if(parent)cache[normalize(entry.source)]={nl:parent.nl?(parent.nl.length>260?parent.nl.slice(0,245).replace(/\s+\S*$/,'')+'…':parent.nl):undefined,en:parent.en.length>260?parent.en.slice(0,245).replace(/\s+\S*$/,'')+'…':parent.en,fr:parent.fr.length>260?parent.fr.slice(0,245).replace(/\s+\S*$/,'')+'…':parent.fr};}
 for(const locale of (mode==='content'?['nl','en','fr']:['en','fr'])){
  const index=locale==='en'?0:1;
  const result={};
  for(const [source,values]of Object.entries(cache))if(allowed.has(normalize(source))&&typeof values[locale]==='string'){
   let value=values[locale];
   // OPUS may emit a spurious Chinese punctuation token for decorative quotes.
   if(!/[\u3400-\u9fff]/u.test(source))value=value.replace(/\u7684/g,'');
   if(mode==='content')value=localizeOpeningHours(source,locale)??value;
   if(mode==='content'&&locale!=='nl')value=value.replace(/\bBron bijgewerkt\s*:/g,locale==='en'?'Source updated:':'Source mise à jour le :').replace(/\bBron\s*:/g,locale==='en'?'Source:':'Source :');
   result[mode==='ui'?normalize(source):key(source)]=value;
  }
  if(mode==='ui')for(const row of reviewed)result[normalize(row[0])]=row[index+1];
  if(mode==='ui'){
   const labels=new Map(reviewed.map(row=>[normalize(row[0]).toLocaleLowerCase('nl'),row[index+1]]));
   const exact=new Map(reviewed.map(row=>[normalize(row[0]),row[index+1]]));
   for(const source of Object.keys(result)){if(exact.has(source))continue;const value=labels.get(source.toLocaleLowerCase('nl'));if(value)result[source]=source===source.toLocaleUpperCase('nl')&&/\p{L}/u.test(source)?value.toLocaleUpperCase(locale):source===source.toLocaleLowerCase('nl')&&!/^[A-Z]{2}/.test(value)?value.charAt(0).toLocaleLowerCase(locale)+value.slice(1):value;}
  }
  if(mode==='ui')for(const name of protectedValues)if(Object.hasOwn(result,normalize(name))&&!reviewedKeys.has(normalize(name)))result[normalize(name)]=name;
  if(mode==='content'&&locale!=='nl')for(const row of reviewed)if(allowed.has(normalize(row[0])))result[key(row[0])]=row[index+1];
  if(mode==='content'&&locale==='nl'&&fs.existsSync('lib/translations/reviewed-nl.json'))for(const [source,value]of Object.entries(JSON.parse(fs.readFileSync('lib/translations/reviewed-nl.json','utf8'))))if(allowed.has(normalize(source)))result[key(source)]=value;
  const missing=sources.filter(source=>!Object.hasOwn(result,mode==='ui'?normalize(source):key(source)));
  report[mode][locale]={sourceTexts:sources.length,translated:Object.keys(result).length,missing:missing.length};
  const target=mode==='ui'?`app/i18n/messages/${locale}.json`:`lib/translations/content-${locale}.json`;
  fs.writeFileSync(target,JSON.stringify(result));
  if(mode==='content'&&locale==='en')fs.writeFileSync('lib/translations/content-index.json',JSON.stringify(Object.keys(result)));
 }
}
fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync('outputs/translation-coverage.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

