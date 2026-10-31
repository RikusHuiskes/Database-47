"use client";
import {useCallback,useEffect,useRef,useState,useMemo} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {analyticsRows,type AnalyticsReport as Report} from '../../lib/analytics-report';
const number=(n:number)=>new Intl.NumberFormat('nl-NL').format(n);
export default function AnalyticsDashboard({client}:{client:SupabaseClient|null}){
  const [days,setDays]=useState(30),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [tab,setTab]=useState('overview');
  const [showFullReport,setShowFullReport]=useState(false);
  const requestId=useRef(0);
  const load=useCallback(async()=>{
    if(!client)return;const id=++requestId.current;setLoading(true);setError('');setReport(null);
    try{const {data,error}=await client.rpc('site_analytics_report',{p_days:days});
      if(error)throw new Error(error.code==='PGRST202'?'Analytics is nog niet geactiveerd in deze database. De databasemigratie ontbreekt.':`Statistieken ophalen mislukt: ${error.message}`);
      if(id===requestId.current)setReport(data as Report);
    }catch(cause){if(id===requestId.current)setError(cause instanceof Error?cause.message:'Statistieken zijn tijdelijk niet beschikbaar.');}finally{if(id===requestId.current)setLoading(false);}
  },[client,days]);
  useEffect(()=>{void load();},[load]);
  async function download(format:'csv'|'xlsx'='csv'){
    if(!report||!client)return;
    setError('');
    try {
      const {data}=await client.auth.getSession();
      if(!data.session?.access_token)throw Error('Log opnieuw in als beheerder om de CSV te downloaden.');
      // An HTTP attachment avoids blob: links being opened by browser/app
      // handoff handlers. The access token is sent only in the POST body.
      const frame=document.createElement('iframe');frame.hidden=true;frame.name='analytics-csv-'+crypto.randomUUID();
      frame.onload=()=>{try{const text=frame.contentDocument?.body?.textContent??'';if(text.startsWith('{')){const result=JSON.parse(text);if(result.error)setError(result.error);}}catch{}};
      document.body.appendChild(frame);
      const form=document.createElement('form');form.hidden=true;form.method='POST';form.action='/api/admin/analytics-export';form.target=frame.name;
      for(const [name,value]of Object.entries({access_token:data.session.access_token,days:String(days),format})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);}
      document.body.appendChild(form);form.submit();form.remove();
      window.setTimeout(()=>frame.remove(),60000);
    } catch(cause){setError(cause instanceof Error?cause.message:'De CSV-download kon niet worden gestart.');}
  }
  const tabs=[['overview','Overzicht'],['periods','Dagen & maanden'],['categories','Categorieën'],['places','Plaatsen'],['filters','Zoekfilters'],['advertisers','Adverteerders']];
  const table=(headings:string[],rows:(string|number)[][])=><ReportTable key={tab+headings[0]} headings={headings} rows={rows}/>;
  return <section className="analytics-dashboard" aria-labelledby="analytics-title">
    <h2 id="analytics-title">Bezoekers & advertentiebereik</h2>
    <p>Gemeten bezoeken met toestemming. Kies een tabblad voor details. De CSV bevat alle onderdelen voor de gekozen periode.</p>
    <div className="analytics-controls"><label>Periode <select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,365].map(d=><option key={d} value={d}>Laatste {d} dagen</option>)}</select></label><button type="button" onClick={()=>void load()} disabled={loading}>Vernieuwen</button><button type="button" onClick={()=>void download("xlsx")} disabled={!report||loading}>Download Excel (.xlsx)</button><button type="button" onClick={()=>void download("csv")} disabled={!report||loading}>Download CSV (.csv)</button></div>
    {loading&&<p role="status">Statistieken laden…</p>}{error&&<p role="alert">{error}</p>}
    <p className="form-hint">Opent het CSV-bestand in ChatGPT? Kies Download Excel of Volledig rapport direct bekijken. Je kunt de CSV ook vanuit Excel openen via Bestand → Openen.</p>
    {report&&<>
      <details className="analytics-export-preview" open={showFullReport} onToggle={event=>setShowFullReport(event.currentTarget.open)}><summary>Volledig rapport direct bekijken</summary>{showFullReport&&<div className="analytics-export-scroll"><table><caption>Alle rapportonderdelen · laatste {days} dagen</caption><tbody>{analyticsRows(report,days).map((row,index)=><tr key={index}>{row.length?row.map((cell,column)=><td key={column}>{String(cell??"")}</td>):<td colSpan={9} aria-hidden="true">&nbsp;</td>}</tr>)}</tbody></table></div>}</details>
      <div className="analytics-kpis">{[['Bezoekers',report.summary.visitors],['Bezoeken',report.summary.visits],['Paginaweergaven',report.summary.pageviews],['Evenementen geopend',report.summary.views],['Zichtbare vermeldingen',report.summary.impressions],['Doorklikken',report.summary.clicks]].map(([label,value])=><div key={label}><span>{label}</span><strong>{number(Number(value))}</strong></div>)}</div>
      <div className="analytics-tabs" role="tablist" aria-label="Statistiekonderdelen">{tabs.map(([id,label])=><button type="button" role="tab" id={'analytics-tab-'+id} aria-controls="analytics-panel" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}>{label}</button>)}</div>
      <div id="analytics-panel" role="tabpanel" aria-labelledby={'analytics-tab-'+tab}>
        {tab==='overview'&&<><h3>In één oogopslag</h3><p>Totaal gemeten bezoekers binnen de bewaartermijn van 13 maanden: <strong>{number(report.totalMeasuredVisitors)}</strong>. Oudste meting: {report.firstMeasuredAt?new Date(report.firstMeasuredAt).toLocaleDateString('nl-NL'):'nog geen metingen'}.</p>
          {table(['Pagina','Weergaven','Bezoekers'],report.pages.map(p=>[p.name==='/'?'Agenda':p.name,p.views,p.visitors]))}
          <p>Een bezoeker is een browsercode, geen gegarandeerd unieke persoon. Beheerders worden uitgesloten. Categorieën kunnen overlappen. Reserveringsklikken zijn geen bevestigde boekingen.</p></>}
        {tab==='periods'&&<><h3>Bezoekers per dag</h3>{table(['Dag','Bezoekers','Bezoeken'],report.daily.map(d=>[d.day,d.visitors,d.visits]))}<h3>Ontwikkeling per maand</h3>{table(['Maand','Bezoekers','Bezoeken','Paginaweergaven'],report.monthly.map(m=>[m.month,m.visitors,m.visits,m.pageviews]))}</>}
        {tab==='categories'&&<><h3>Bereik per categorie</h3>{table(['Categorie','Bezoekers','Bezoeken','Gekozen','Geopend','Doorklikken'],report.categories.map(c=>[c.name,c.visitors,c.visits,c.selections,c.views,c.clicks]))}</>}
        {tab==='places'&&<><h3>Gezochte plaatsen</h3>{table(['Plaats','Bezoekers','Keuzes'],report.places.map(p=>[p.name,p.visitors,p.searches]))}</>}
        {tab==='filters'&&<><h3>Plaats-, categorie- en afstandsfilters</h3><p>Inclusief de beginselectie; geen vrije zoektekst of precieze locatie opgeslagen.</p>{table(['Plaats','Categorie','Afstand (km)','Toepassingen'],report.filters.map(f=>[f.area??'Huidige locatie',f.category??'Alle categorieën',f.radius_km,f.uses]))}</>}
        {tab==='advertisers'&&<><h3>Evenementen & resultaten voor adverteerders</h3><p>Een zichtbare vermelding telt eenmaal per bezoek en plaatsing, na 1 seconde met minstens 50% in beeld. Klikratio: aandeel bereikte bezoeken dat daarna naar een externe link doorklikte.</p>{table(['Evenement','Bereikte bezoeken','Vermeldingen','Geopend','Doorklikken','Reserveringsklikken','Klikratio'],report.events.map(e=>[e.name,e.reached_sessions,e.impressions,e.views,e.clicks,e.bookings,e.reached_sessions?(100*e.clicked_sessions/e.reached_sessions).toFixed(1)+'%':'—']))}</>}
      </div>
      <p><small>Bijgewerkt: {new Date(report.generatedAt).toLocaleString('nl-NL')}. Alleen geaggregeerde cijfers delen met adverteerders.</small></p>
    </>}
  </section>;
}

function ReportTable({headings,rows}:{headings:string[];rows:(string|number)[][]}){
  const [query,setQuery]=useState(''),[page,setPage]=useState(1),[size,setSize]=useState(10),[sort,setSort]=useState<{index:number;descending:boolean}|null>(null);
  const filtered=useMemo(()=>{
    const value=query.toLocaleLowerCase('nl');
    const result=rows.filter(row=>row.some(cell=>String(cell).toLocaleLowerCase('nl').includes(value)));
    if(sort)result.sort((a,b)=>{const left=a[sort.index],right=b[sort.index];const delta=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'nl',{numeric:true,sensitivity:'base'});return sort.descending?-delta:delta;});
    return result;
  },[rows,query,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.min(page,pages);
  return <div className="analytics-report-table"><div className="analytics-controls"><label>Zoeken <input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Zoek in deze tabel"/></label><label>Rijen <select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select></label><span>{filtered.length} resultaten</span></div>
    <div className="analytics-table"><table><thead><tr>{headings.map((heading,index)=><th key={heading} aria-sort={sort?.index===index?(sort.descending?'descending':'ascending'):'none'}><button type="button" onClick={()=>{setSort({index,descending:sort?.index===index?!sort.descending:false});setPage(1);}}>{heading}{sort?.index===index?(sort.descending?' ↓':' ↑'):''}</button></th>)}</tr></thead><tbody>{filtered.slice((current-1)*size,current*size).map((row,index)=><tr key={(current-1)*size+index}>{row.map((cell,column)=><td key={column}>{typeof cell==='number'?number(cell):cell}</td>)}</tr>)}</tbody></table>{!filtered.length&&<p>Geen metingen gevonden.</p>}</div>
    <div className="analytics-controls"><button type="button" disabled={current<=1} onClick={()=>setPage(current-1)}>Vorige</button><span>Pagina {current} van {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(current+1)}>Volgende</button></div>
  </div>;
}
