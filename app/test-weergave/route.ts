export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(process.env.VERCEL_ENV!=='preview')return new Response('Niet gevonden',{status:404});
 const sizes={mobiel:{width:390,height:844,name:'Mobiel'},klein:{width:360,height:800,name:'Kleine telefoon'},tablet:{width:768,height:1024,name:'Tablet staand'},breed:{width:1024,height:768,name:'Tablet liggend'}};
 const url=new URL(request.url),key=url.searchParams.get('formaat')??'mobiel';
 const size=sizes[key as keyof typeof sizes]??sizes.mobiel;
 const pages={'agenda':'/#agenda','gemeenten':'/#gemeenten','handleiding':'/handleiding','streek':'/de-streek-beleven','vermelding':'/mijn-vermelding','beheer':'/#beheer'};
 const page=url.searchParams.get('pagina')??'agenda',path=pages[page as keyof typeof pages]??pages.agenda;
 const sizeLinks=Object.entries(sizes).map(([id,s])=>'<a href="?formaat='+id+'&pagina='+encodeURIComponent(page)+'">'+s.name+' ('+s.width+')</a>').join(' · ');
 const pageLinks=Object.keys(pages).map(id=>'<a href="?formaat='+encodeURIComponent(key)+'&pagina='+id+'">'+id+'</a>').join(' · ');
 const html='<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Apparaattest — Côte de Duras</title><style>body{margin:0;padding:12px;background:#e9eee9;color:#193f35;font:14px/1.5 system-ui}nav{margin-bottom:8px}a{color:inherit}iframe{display:block;border:1px solid #8c9d91;background:white;margin:0 auto}p{margin:6px 0}</style><body><nav aria-label="Schermformaat">'+sizeLinks+'</nav><nav aria-label="Testpagina">'+pageLinks+'</nav><p><strong>'+size.name+' — '+size.width+' × '+size.height+' CSS-pixels</strong>. Alleen op preview. Dit test de responsieve pagina; geen echte telefoonhardware.</p><iframe title="Côte de Duras apparaattest" src="'+path+'" width="'+size.width+'" height="'+size.height+'"></iframe></body></html>';
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'"}});
}
