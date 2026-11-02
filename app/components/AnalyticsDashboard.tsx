"use client";
import {intlLocale,type Locale} from '../../lib/i18n';
import {T, A, useLanguage} from '../i18n/Language';

import {useCallback,useEffect,useRef,useState,useMemo} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {analyticsRows,type AnalyticsReport as Report} from '../../lib/analytics-report';
import {saveReportFile,type ReportFilePicker} from '../../lib/save-report-file';
const displayNumber=(n:number,locale:Locale)=>new Intl.NumberFormat(intlLocale[locale]).format(n);
export default function AnalyticsDashboard({client}:{client:SupabaseClient|null}){
 const {locale}=useLanguage();const number=(value:number)=>displayNumber(value,locale);
  const [days,setDays]=useState(30),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [tab,setTab]=useState('overview');
  const [saving,setSaving]=useState(false),[saveMessage,setSaveMessage]=useState('');
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
    if(!report||!client||saving)return;
    setError('');setSaveMessage('');setSaving(true);
    try {
      const picker=(window as Window&{showSaveFilePicker?:ReportFilePicker}).showSaveFilePicker;
      const filename=await saveReportFile(picker?.bind(window),format,days,async()=>{
        const {data}=await client.auth.getSession();
        if(!data.session?.access_token)throw Error('Log opnieuw in als beheerder om het rapport op te slaan.');
        const response=await fetch('/api/admin/analytics-export',{method:'POST',credentials:'same-origin',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({days:String(days),format,lang:locale})});
        if(!response.ok){const result=await response.json().catch(()=>null);throw Error(result?.error||'Het rapport kon niet worden opgehaald.');}
        const type=response.headers.get('Content-Type')??'';
        if(format==='csv'?!type.startsWith('text/csv'):!type.includes('spreadsheetml.sheet'))throw Error('Er is geen geldig rapport ontvangen. Probeer opnieuw.');
        return response.blob();
      });
      setSaveMessage('Opgeslagen: '+filename);
    } catch(cause){if(cause instanceof Error&&cause.name==='AbortError')setSaveMessage('Opslaan geannuleerd.');else setError(cause instanceof Error?cause.message:'Het rapport kon niet worden opgeslagen.');}
    finally{setSaving(false);}
  }
  const tabs=[['overview','Overzicht'],['periods','Dagen & maanden'],['categories','Categorieën'],['places','Plaatsen'],['filters','Zoekfilters'],['advertisers','Adverteerders']];
  const table=(headings:string[],rows:(string|number)[][])=><ReportTable key={tab+headings[0]} headings={headings} rows={rows}/>;
  return <section className="analytics-dashboard" aria-labelledby="analytics-title">
    <h2 id="analytics-title"><T>{"Bezoekers & advertentiebereik"}</T></h2>
    <p><T>{"Gemeten bezoeken met toestemming. Kies een tabblad voor details. De CSV bevat alle onderdelen voor de gekozen periode."}</T></p>
    <div className="analytics-controls"><label><T>{"Periode "}</T><select value={days} onChange={e=>setDays(Number(e.target.value))}><T>{[7,30,90,365].map(d=><option key={d} value={d}><T>{"Laatste "}</T><T>{d}</T><T>{" dagen"}</T></option>)}</T></select></label><button type="button" onClick={()=>void load()} disabled={loading}><T>{"Vernieuwen"}</T></button><button type="button" onClick={()=>void download("xlsx")} disabled={!report||loading||saving}><T>{"Excel opslaan als…"}</T></button><button type="button" onClick={()=>void download("csv")} disabled={!report||loading||saving}><T>{"CSV opslaan als…"}</T></button></div>
    <T>{loading&&<p role="status"><T>{"Statistieken laden…"}</T></p>}</T><T>{error&&<p role="alert"><T>{error}</T></p>}</T>
    <T>{saveMessage&&<p role="status"><T>{saveMessage}</T></p>}</T>
    <p className="form-hint"><T>{"Kies waar je het rapport wilt opslaan. Het bestand wordt opgeslagen zonder een nieuwe pagina te openen."}</T></p>
    <T>{report&&<>
      <details className="analytics-export-preview" open={showFullReport} onToggle={event=>setShowFullReport(event.currentTarget.open)}><summary><T>{"Volledig rapport direct bekijken"}</T></summary><T>{showFullReport&&<div className="analytics-export-scroll"><table><caption><T>{"Alle rapportonderdelen · laatste "}</T><T>{days}</T><T>{" dagen"}</T></caption><tbody><T>{analyticsRows(report,days).map((row,index)=><tr key={index}><T>{row.length?row.map((cell,column)=><td key={column}><T>{String(cell??"")}</T></td>):<td colSpan={9} aria-hidden="true"><T>{" "}</T></td>}</T></tr>)}</T></tbody></table></div>}</T></details>
      <div className="analytics-kpis"><T>{[['Bezoekers',report.summary.visitors],['Bezoeken',report.summary.visits],['Paginaweergaven',report.summary.pageviews],['Evenementen geopend',report.summary.views],['Zichtbare vermeldingen',report.summary.impressions],['Doorklikken',report.summary.clicks]].map(([label,value])=><div key={label}><span><T>{label}</T></span><strong><T>{number(Number(value))}</T></strong></div>)}</T></div>
      <A><div className="analytics-tabs" role="tablist" aria-label="Statistiekonderdelen"><T>{tabs.map(([id,label])=><button type="button" role="tab" id={'analytics-tab-'+id} aria-controls="analytics-panel" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}><T>{label}</T></button>)}</T></div></A>
      <div id="analytics-panel" role="tabpanel" aria-labelledby={'analytics-tab-'+tab}>
        <T>{tab==='overview'&&<><h3><T>{"In één oogopslag"}</T></h3><p><T>{"Totaal gemeten bezoekers binnen de bewaartermijn van 13 maanden: "}</T><strong><T>{number(report.totalMeasuredVisitors)}</T></strong><T>{". Oudste meting: "}</T><T>{report.firstMeasuredAt?new Date(report.firstMeasuredAt).toLocaleDateString(intlLocale[locale]):'nog geen metingen'}</T><T>{"."}</T></p>
          <T>{table(['Pagina','Weergaven','Bezoekers'],report.pages.map(p=>[p.name==='/'?'Agenda':p.name,p.views,p.visitors]))}</T>
          <p><T>{"Een bezoeker is een browsercode, geen gegarandeerd unieke persoon. Beheerders worden uitgesloten. Categorieën kunnen overlappen. Reserveringsklikken zijn geen bevestigde boekingen."}</T></p></>}</T>
        <T>{tab==='periods'&&<><h3><T>{"Bezoekers per dag"}</T></h3><T>{table(['Dag','Bezoekers','Bezoeken'],report.daily.map(d=>[d.day,d.visitors,d.visits]))}</T><h3><T>{"Ontwikkeling per maand"}</T></h3><T>{table(['Maand','Bezoekers','Bezoeken','Paginaweergaven'],report.monthly.map(m=>[m.month,m.visitors,m.visits,m.pageviews]))}</T></>}</T>
        <T>{tab==='categories'&&<><h3><T>{"Bereik per categorie"}</T></h3><T>{table(['Categorie','Bezoekers','Bezoeken','Gekozen','Geopend','Doorklikken'],report.categories.map(c=>[c.name,c.visitors,c.visits,c.selections,c.views,c.clicks]))}</T></>}</T>
        <T>{tab==='places'&&<><h3><T>{"Gezochte plaatsen"}</T></h3><T>{table(['Plaats','Bezoekers','Keuzes'],report.places.map(p=>[p.name,p.visitors,p.searches]))}</T></>}</T>
        <T>{tab==='filters'&&<><h3><T>{"Plaats-, categorie- en afstandsfilters"}</T></h3><p><T>{"Inclusief de beginselectie; geen vrije zoektekst of precieze locatie opgeslagen."}</T></p><T>{table(['Plaats','Categorie','Afstand (km)','Toepassingen'],report.filters.map(f=>[f.area??'Huidige locatie',f.category??'Alle categorieën',f.radius_km,f.uses]))}</T></>}</T>
        <T>{tab==='advertisers'&&<><h3><T>{"Evenementen & resultaten voor adverteerders"}</T></h3><p><T>{"Een zichtbare vermelding telt eenmaal per bezoek en plaatsing, na 1 seconde met minstens 50% in beeld. Klikratio: aandeel bereikte bezoeken dat daarna naar een externe link doorklikte."}</T></p><T>{table(['Evenement','Bereikte bezoeken','Vermeldingen','Geopend','Doorklikken','Reserveringsklikken','Klikratio'],report.events.map(e=>[e.name,e.reached_sessions,e.impressions,e.views,e.clicks,e.bookings,e.reached_sessions?(100*e.clicked_sessions/e.reached_sessions).toFixed(1)+'%':'—']))}</T></>}</T>
      </div>
      <p><small><T>{"Bijgewerkt: "}</T><T>{new Date(report.generatedAt).toLocaleString(intlLocale[locale])}</T><T>{". Alleen geaggregeerde cijfers delen met adverteerders."}</T></small></p>
    </>}</T>
  </section>;
}

function ReportTable({headings,rows}:{headings:string[];rows:(string|number)[][]}){
 const {locale}=useLanguage();const number=(value:number)=>displayNumber(value,locale);
  const [query,setQuery]=useState(''),[page,setPage]=useState(1),[size,setSize]=useState(10),[sort,setSort]=useState<{index:number;descending:boolean}|null>(null);
  const filtered=useMemo(()=>{
    const value=query.toLocaleLowerCase('nl');
    const result=rows.filter(row=>row.some(cell=>String(cell).toLocaleLowerCase('nl').includes(value)));
    if(sort)result.sort((a,b)=>{const left=a[sort.index],right=b[sort.index];const delta=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'nl',{numeric:true,sensitivity:'base'});return sort.descending?-delta:delta;});
    return result;
  },[rows,query,sort]);
  const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.min(page,pages);
  return <div className="analytics-report-table"><div className="analytics-controls"><label><T>{"Zoeken "}</T><A><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Zoek in deze tabel"/></A></label><label><T>{"Rijen "}</T><select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}><T>{[10,25,50].map(n=><option key={n} value={n}><T>{n}</T></option>)}</T></select></label><span><T>{filtered.length}</T><T>{" resultaten"}</T></span></div>
    <div className="analytics-table"><table><thead><tr><T>{headings.map((heading,index)=><th key={heading} aria-sort={sort?.index===index?(sort.descending?'descending':'ascending'):'none'}><button type="button" onClick={()=>{setSort({index,descending:sort?.index===index?!sort.descending:false});setPage(1);}}><T>{heading}</T><T>{sort?.index===index?(sort.descending?' ↓':' ↑'):''}</T></button></th>)}</T></tr></thead><tbody><T>{filtered.slice((current-1)*size,current*size).map((row,index)=><tr key={(current-1)*size+index}><T>{row.map((cell,column)=><td key={column}><T>{typeof cell==='number'?number(cell):cell}</T></td>)}</T></tr>)}</T></tbody></table><T>{!filtered.length&&<p><T>{"Geen metingen gevonden."}</T></p>}</T></div>
    <div className="analytics-controls"><button type="button" disabled={current<=1} onClick={()=>setPage(current-1)}><T>{"Vorige"}</T></button><span><T>{"Pagina "}</T><T>{current}</T><T>{" van "}</T><T>{pages}</T></span><button type="button" disabled={current>=pages} onClick={()=>setPage(current+1)}><T>{"Volgende"}</T></button></div>
  </div>;
}
