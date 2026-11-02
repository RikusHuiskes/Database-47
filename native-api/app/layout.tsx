import {localizeMetadata} from '../../app/i18n/server';
import type {Metadata} from 'next';
import '../../app/globals.css';
import {cookies} from 'next/headers';
import {LanguageProvider} from '../../app/i18n/Language';
import {LOCALE_COOKIE,localeFrom} from '../../lib/i18n';
const sourceMetadata:Metadata={title:'Cote de Duras',description:'Agenda en gemeentegids binnen 50 km rond Duras.',robots:{index:false,follow:false},manifest:'/ios-preview.webmanifest',appleWebApp:{capable:true,title:'Cote de Duras',statusBarStyle:'default'},icons:{apple:'/cote-de-duras-ios-icon.png',icon:'/cote-de-duras-icon.png'}};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}
export default async function Layout({children}:{children:React.ReactNode}){const locale=localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);return <html lang={locale}><body style={{margin:0,fontFamily:'Arial,sans-serif'}}><LanguageProvider initialLocale={locale}>{children}</LanguageProvider></body></html>;}
