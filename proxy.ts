import {NextResponse,type NextRequest} from 'next/server';
import {LOCALE_COOKIE,startsNewLanguageVisit} from './lib/i18n';

export function proxy(request:NextRequest){
 if(!startsNewLanguageVisit(request))return NextResponse.next();
 // Replace only the language preference; leave sign-in and management cookies intact.
 const headers=new Headers(request.headers);
 const cookies=(headers.get('cookie')??'').split(';').filter(value=>value.trim()&&value.trim().split('=')[0]!==LOCALE_COOKIE);
 headers.set('cookie',[...cookies,`${LOCALE_COOKIE}=fr`].join('; '));
 const response=NextResponse.next({request:{headers}});
 response.cookies.set(LOCALE_COOKIE,'fr',{path:'/',sameSite:'lax',secure:request.nextUrl.protocol==='https:'});
 response.headers.set('Cache-Control','private, no-store');
 return response;
}

export const config={matcher:['/((?!api|_next|.*\\..*).*)']};
