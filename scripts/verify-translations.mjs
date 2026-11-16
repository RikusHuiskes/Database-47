import fs from 'node:fs';
const keys=JSON.parse(fs.readFileSync(new URL('../lib/translations/content-index.json',import.meta.url),'utf8'));
const report=JSON.parse(fs.readFileSync(new URL('../outputs/translation-coverage.json',import.meta.url),'utf8'));
if(!keys.length)throw Error('Public translation index is empty.');
for(const locale of ['nl','en','fr']){
 const dictionary=JSON.parse(fs.readFileSync(new URL(`../lib/translations/content-${locale}.json`,import.meta.url),'utf8'));
 const missing=keys.filter(key=>typeof dictionary[key]!=='string');
 if(missing.length||report.content?.[locale]?.missing!==0)throw Error(`${locale}: public translation coverage is incomplete (${missing.length} missing keys).`);
 console.log(`${locale}: ${keys.length} public texts covered`);
}
for(const locale of ['en','fr'])if(report.ui?.[locale]?.missing!==0)throw Error(`${locale}: interface translation coverage is incomplete.`);
// Hand-reviewed corrections must stay attached to existing source identities.
const reviewedDutch=JSON.parse(fs.readFileSync(new URL('../lib/translations/reviewed-public-nl.json',import.meta.url),'utf8'));
const indexedKeys=new Set(keys);
for(const [key,value]of Object.entries(reviewedDutch))if(!indexedKeys.has(key)||typeof value!=='string'||!value.trim())throw Error(`Invalid reviewed Dutch content: ${key}`);
console.log(`nl: ${Object.keys(reviewedDutch).length} reviewed public-content corrections`);
