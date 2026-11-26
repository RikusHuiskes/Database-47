import {NextResponse,type NextRequest} from 'next/server';
import {LOCALE_COOKIE,localeFrom,startsNewLanguageVisit} from './lib/i18n';

export function proxy(request:NextRequest){
 const requested=request.nextUrl.pathname==='/travaux'?request.nextUrl.searchParams.get('lang'):null;
 const explicit=requested==='nl'||requested==='en'||requested==='fr';
 const current=request.cookies.get(LOCALE_COOKIE)?.value;
 if(explicit?current===requested:!startsNewLanguageVisit(request))return NextResponse.next();
 const locale=localeFrom(explicit?requested:null);
 // Replace only the language preference; leave sign-in and management cookies intact.
 const headers=new Headers(request.headers);
 const cookies=(headers.get('cookie')??'').split(';').filter(value=>value.trim()&&value.trim().split('=')[0]!==LOCALE_COOKIE);
 headers.set('cookie',[...cookies,`${LOCALE_COOKIE}=${locale}`].join('; '));
 const response=NextResponse.next({request:{headers}});
 response.cookies.set(LOCALE_COOKIE,locale,{path:'/',sameSite:'lax',secure:request.nextUrl.protocol==='https:'});
 response.headers.set('Cache-Control','private, no-store');
 return response;
}

export const config={matcher:['/((?!api|_next|.*\\..*).*)']};
