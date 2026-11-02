import {localeFrom,messageKey,createTranslator,type Locale} from './i18n';
import en from './translations/content-en.json';import fr from './translations/content-fr.json';
import enUi from '../app/i18n/messages/en.json';import frUi from '../app/i18n/messages/fr.json';
const ui={en:createTranslator('en',enUi),fr:createTranslator('fr',frUi)};
const fields=new Set(['description','short_description','details','extra','openingHours','serviceTimes','notes','warning','notice']);
export function requestLocale(request:Request):Locale{return localeFrom(new URL(request.url).searchParams.get('lang')??request.headers.get('cookie')?.match(/(?:^|;\s*)cdd-language=(nl|en|fr)(?:;|$)/)?.[1]);}
/** Only presentation copy. Never translate businesses, contact details, IDs, prices or coordinates. */
export function localizePublicData<T>(data:T,locale:Locale):T{
 if(locale==='nl')return data;
 const dictionary=(locale==='en'?en:fr) as Record<string,string>;
 function visit(value:unknown):unknown{
  if(Array.isArray(value))return value.map(visit);
  if(!value||typeof value!=='object')return value;
  const object=value as Record<string,unknown>,copy:Record<string,unknown>={};
  for(const [key,entry]of Object.entries(object)){
   if(typeof entry==='string'&&(fields.has(key)||(key==='title'&&object.is_directory_entry===false)))copy[key]=dictionary[messageKey(entry)]??ui[locale](entry);
   else copy[key]=typeof entry==='object'?visit(entry):entry;
  }
  return copy;
 }
 return visit(data) as T;
}
