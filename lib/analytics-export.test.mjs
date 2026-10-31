import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {analyticsCsv} from './analytics-report.ts';

const report={generatedAt:'2026-10-31',firstMeasuredAt:null,totalMeasuredVisitors:12,summary:{visitors:2,visits:3,pageviews:4,views:5,impressions:6,clicks:7},monthly:[{month:'2026-10',visitors:2,visits:3,pageviews:4}],pages:[{name:'Agenda',views:4,visitors:2}],filters:[{area:'Bergerac',category:'Restaurants',radius_km:10,uses:2}],daily:[{day:'2026-10-31',visitors:2,visits:3}],places:[{name:'Duras',visitors:2,searches:3}],categories:[{name:'Cafés',visitors:2,visits:3,selections:4,views:5,clicks:6}],events:[{event_id:'one',name:'=HYPERLINK("bad")',impressions:1,views:2,clicks:3,bookings:4,visitors:5,reached_sessions:6,clicked_sessions:1}]};
test('CSV contains every report section, Dutch accents, Excel BOM and safe cells',()=>{
  const csv=analyticsCsv(report,30);
  assert.equal(csv.charCodeAt(0),0xfeff);
  for(const value of ['Maand','Pagina','Filterplaats','Dag','Plaats','Categorie','Evenement','Cafés','Bergerac','Toelichting'])assert(csv.includes('"'+value+'"'));
  assert(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert(csv.includes('"Periode (dagen)";"30"'));
});

test('Actual export handler rejects unauthorised/cross-site requests and returns a private CSV attachment to admins',async()=>{
  let source=stripTypeScriptTypes(readFileSync(new URL('../app/api/admin/analytics-export/route.ts',import.meta.url),'utf8'));
  source=source.replace(/import \{\s*createClient\s*\} from ['"]@supabase\/supabase-js['"];?/, 'let createClient; export function configure(factory){createClient=factory;}');
  source=source.replace(/from ['"]\.\.\/\.\.\/\.\.\/\.\.\/lib\/analytics-report['"]/,`from '${new URL('./analytics-report.ts',import.meta.url).href}'`);
  const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,originalKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
  const request=(body,origin='https://example.test')=>new Request('https://example.test/api/admin/analytics-export',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body});
  try{
    assert.equal((await route.POST(request('days=30','https://evil.test'))).status,403);
    assert.equal((await route.POST(request('days=30'))).status,401);
    assert.equal((await route.POST(request('days=1000&access_token=test'))).status,400);
    let isAdmin=false,failReport=false;
    route.configure((url,key,options)=>{assert.equal(options.global.headers.Authorization,'Bearer test');return {async rpc(name,args){if(name==='is_admin')return {data:isAdmin};assert.equal(name,'site_analytics_report');assert.deepEqual(args,{p_days:30});return failReport?{error:{message:'private'}}:{data:report};}};});
    assert.equal((await route.POST(request('days=30&access_token=test'))).status,403);
    isAdmin=true;
    const response=await route.POST(request('days=30&access_token=test'));
    assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/^attachment; filename="cote-de-duras-bereik-30-dagen.csv"$/);
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.match(response.headers.get('Content-Type'),/text\/csv/);
    assert.equal(Buffer.from(await response.arrayBuffer()).toString("utf8"),analyticsCsv(report,30));
    failReport=true;assert.equal((await route.POST(request('days=30&access_token=test'))).status,502);
  }finally{if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;if(originalKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=originalKey;}
});
