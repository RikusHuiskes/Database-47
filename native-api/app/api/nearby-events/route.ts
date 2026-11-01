import {NextRequest} from 'next/server';
import {GET as events} from '../../../../app/api/nearby-events/route';
export const maxDuration=60;
export async function GET(request:NextRequest){const url=new URL(request.url);url.searchParams.set('lat','44.6755');url.searchParams.set('lon','0.2021');url.searchParams.set('radius',String(Math.min(50,Math.max(5,Number(url.searchParams.get('radius'))||50))));const response=await events(new NextRequest(url));if(response.ok)response.headers.set('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=300');return response;}
