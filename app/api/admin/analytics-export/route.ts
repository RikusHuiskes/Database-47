import {createClient} from '@supabase/supabase-js';
import {analyticsWorkbook} from '../../../../lib/analytics-workbook';
import {analyticsCsv,type AnalyticsReport} from '../../../../lib/analytics-report';

export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request) {
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige rapportaanvraag.'},{status:403,headers});
  try {
    const text=await request.text();if(text.length>10000)return Response.json({error:'Rapportaanvraag is te groot.'},{status:413,headers});
    const form=new URLSearchParams(text),token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]??form.get('access_token');
    if(!token)return Response.json({error:'Log opnieuw in als beheerder.'},{status:401,headers});
    const format=form.get('format')??'csv';
    if(!['csv','xlsx'].includes(format))return Response.json({error:'Kies CSV of Excel.'},{status:400,headers});
    const days=Number(form.get('days'));
    if(![7,30,90,365].includes(days))return Response.json({error:'Kies een geldige rapportperiode.'},{status:400,headers});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!url||!key)return Response.json({error:'Rapportage is tijdelijk niet beschikbaar.'},{status:503,headers});
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
    const admin=await client.rpc('is_admin');
    if(admin.error||admin.data!==true)return Response.json({error:'Beheerderstoegang vereist.'},{status:403,headers});
    const result=await client.rpc('site_analytics_report',{p_days:days});
    if(result.error||!result.data)return Response.json({error:'Het rapport kon niet worden gemaakt. Vernieuw de statistieken en probeer opnieuw.'},{status:502,headers});
    if(format==='xlsx'){const bytes=await analyticsWorkbook(result.data as AnalyticsReport,days);return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="cote-de-duras-bereik-${days}-dagen.xlsx"`}});}
    return new Response(analyticsCsv(result.data as AnalyticsReport,days),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="cote-de-duras-bereik-${days}-dagen.csv"`}});
  } catch {return Response.json({error:'Het rapport kon niet worden gemaakt. Probeer opnieuw.'},{status:502,headers});}
}
