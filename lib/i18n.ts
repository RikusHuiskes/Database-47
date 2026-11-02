export type Locale='nl'|'en'|'fr';
export const LOCALE_COOKIE='cdd-language';
export function localeFrom(value:unknown):Locale{return value==='en'||value==='fr'?value:'nl';}
export const intlLocale:Record<Locale,string>={nl:'nl-NL',en:'en-GB',fr:'fr-FR'};
export function normalizeMessage(text:string){return text.replace(/\s+/g,' ').trim();}
// Stable key shared with the offline catalogue builder. No personal text is sent to a translator.
export function messageKey(text:string){let hash=BigInt('14695981039346656037');for(const byte of new TextEncoder().encode(normalizeMessage(text))){hash^=BigInt(byte);hash=BigInt.asUintN(64,hash*BigInt('1099511628211'));}return hash.toString(16).padStart(16,'0');}
export type Dictionary=Record<string,string>;
/** Translate generated facility labels, retaining the exact street/operator suffix. */
export function localizeMunicipalName(name:string,locale:Locale):string{
 if(locale==='nl')return name;
 const labels:Record<string,[string,string]>={
  'Invalide parkeerplaatsen':['Accessible parking spaces','Places de stationnement réservées aux personnes handicapées'],
  'Invalide parkeerplaats':['Accessible parking space','Place de stationnement réservée aux personnes handicapées'],
  'Parkeerterrein':['Car park','Parking'],
  'Laadstation':['EV charging station','Borne de recharge'],
  'Trein- of tramhalte':['Train or tram stop','Arrêt de train ou de tramway'],
  'Bushalte':['Bus stop','Arrêt de bus'],
  'Tankstation':['Petrol station','Station-service'],
  'Supermarkt':['Supermarket','Supermarché'],
 };
 for(const [label,translations]of Object.entries(labels))if(name===label||name.startsWith(label+' · '))return translations[locale==='en'?0:1]+name.slice(label.length);
 return name;
}
/** OSM opening-hours notation: expand day codes while keeping every time unchanged. */
export function localizeOpeningHours(source:string,locale:Locale):string|null{
 const tokens=source.match(/[A-Za-z]+/g)??[];
 const en:Record<string,string>={Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun',PH:'public holidays',SH:'school holidays',off:'closed',open:'open',sunrise:'sunrise',sunset:'sunset'};
 const fr:Record<string,string>={Mo:'lun.',Tu:'mar.',We:'mer.',Th:'jeu.',Fr:'ven.',Sa:'sam.',Su:'dim.',PH:'jours fériés',SH:'vacances scolaires',off:'fermé',open:'ouvert',sunrise:'lever du soleil',sunset:'coucher du soleil'};
 if(!tokens.length||tokens.some(token=>!Object.hasOwn(en,token))||!tokens.some(token=>/^(Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)$/.test(token))||!(/\d|\boff\b/.test(source)||tokens.length>1))return null;
 if(locale==='nl')return source;
 const words=locale==='fr'?fr:en;return source.replace(/[A-Za-z]+/g,token=>words[token]);
}
export function translateMessage(source:string,locale:Locale,dictionary:Dictionary):string{
 if(locale==='nl'||!source.trim())return source;
 const key=normalizeMessage(source),value=dictionary[key];
 if(value!==undefined)return source.slice(0,source.length-source.trimStart().length)+value+source.slice(source.trimEnd().length);
 return source;
}

const escapeRegex=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
/** Dynamic counts and names stay data; only the surrounding sentence is translated. */
export function createTranslator(locale:Locale,dictionary:Dictionary){
 const folded=new Map(Object.entries(dictionary).map(([key,value])=>[key.toLocaleLowerCase('nl'),value]));
 const lookup=(source:string):string|undefined=>{
  const key=normalizeMessage(source),exact=Object.hasOwn(dictionary,key),value=exact?dictionary[key]:folded.get(key.toLocaleLowerCase('nl'));
  if(value===undefined)return undefined;
  if(value.toLocaleLowerCase('nl')===key.toLocaleLowerCase('nl'))return source;
  const text=!exact&&key===key.toLocaleLowerCase('nl')&&!/^[A-Z]{2}/.test(value)?value.charAt(0).toLocaleLowerCase(locale)+value.slice(1):value;
  return source.slice(0,source.length-source.trimStart().length)+text+source.slice(source.trimEnd().length);
 };
 const patterns=Object.entries(dictionary).filter(([key])=>/\{\d+\}/.test(key)&&key.replace(/\{\d+\}/g,'').length>5&&(key.match(/\{\d+\}/g)?.length??0)<7).map(([key,value])=>{const literals=key.split(/\{\d+\}/);return {key,value,prefix:literals[0],suffix:literals.at(-1)??'',anchor:[...literals].sort((a,b)=>b.length-a.length)[0],regex:new RegExp('^'+key.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?'(.+?)':escapeRegex(part)).join('')+'$')};}).sort((a,b)=>b.key.length-a.key.length);
 const months=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
 const translate=(source:string,depth=0):string=>{
  if(locale==='nl'||!source.trim())return source;
  const hours=localizeOpeningHours(source,locale);if(hours!==null)return hours;
  const normalized=normalizeMessage(source),direct=lookup(source);
  if(direct!==undefined)return direct;
  if(depth>4)return source;
  const joined=source.split(' + ');
  if(joined.length>1&&joined.every(part=>Object.hasOwn(dictionary,normalizeMessage(part))))return joined.map(part=>translateMessage(part,locale,dictionary)).join(' + ');
  const money=normalized.match(/^€\s*([\d.]+),(\d{2})$/);
  if(money)return new Intl.NumberFormat(intlLocale[locale],{style:'currency',currency:'EUR'}).format(Number(money[1].replaceAll('.','')+'.'+money[2]));
  const date=normalized.match(new RegExp('^(?:(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)[, ]+)?(\\d{1,2}) ('+months.join('|')+') (\\d{4})(.*)$','i'));
  if(date){const result=new Intl.DateTimeFormat(intlLocale[locale],{day:'numeric',month:'long',year:'numeric'}).format(new Date(Number(date[3]),months.indexOf(date[2].toLowerCase()),Number(date[1]),12));return result+date[4];}
  if(normalized.length<2500)for(const pattern of patterns){if(pattern.prefix&&!normalized.startsWith(pattern.prefix)||pattern.suffix&&!normalized.endsWith(pattern.suffix)||!normalized.includes(pattern.anchor))continue;const match=pattern.regex.exec(normalized);if(match){let n=0;const ids=[...pattern.key.matchAll(/\{(\d+)\}/g)].map(x=>x[1]);const values=new Map(ids.map(id=>[id,translate(match[++n],depth+1)]));return pattern.value.replace(/\{(\d+)\}/g,(_all,id)=>values.get(id)??'');}}
  return source;
 };
 return (source:string)=>{
  const translated=translate(source);
  if(locale==='nl')return translated;
  return translated.replace(/€\s*([\d.]+),(\d{2})(?!\d)/g,(_all,whole,fraction)=>new Intl.NumberFormat(intlLocale[locale],{style:'currency',currency:'EUR'}).format(Number(whole.replaceAll('.','')+'.'+fraction)));
 };
}
