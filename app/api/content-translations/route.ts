import {NextResponse} from 'next/server';
import nl from '../../../lib/translations/content-nl.json';
import en from '../../../lib/translations/content-en.json';
import fr from '../../../lib/translations/content-fr.json';
export async function POST(request:Request){
 let input:unknown;try{if(Number(request.headers.get('content-length')||0)>12000)return new Response(null,{status:413});input=await request.json();}catch{return new Response(null,{status:400});}
 const data=input as {locale?:unknown;keys?:unknown};
 if(!data||!['nl','en','fr'].includes(String(data.locale))||!Array.isArray(data.keys)||data.keys.length>100||data.keys.some(key=>typeof key!=='string'||!/^[a-f\d]{16}$/.test(key)))return new Response(null,{status:400});
 const dictionary=(data.locale==='nl'?nl:data.locale==='en'?en:fr) as Record<string,string>,translations:Record<string,string>={};
 for(const key of data.keys as string[])if(Object.hasOwn(dictionary,key))translations[key]=dictionary[key];
 return NextResponse.json({translations},{headers:{'Cache-Control':'private, max-age=3600'}});
}
