"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Category={name:string;visitors:number;visits:number;selections:number;views:number;clicks:number};
type EventStats={event_id:string;name:string;impressions:number;views:number;clicks:number;bookings:number;visitors:number;reached_sessions:number;clicked_sessions:number};
type Report={generatedAt:string;firstMeasuredAt:string|null;totalMeasuredVisitors:number;summary:{visitors:number;visits:number;pageviews:number;views:number;impressions:number;clicks:number};daily:{day:string;visitors:number;visits:number}[];monthly:{month:string;visitors:number;visits:number;pageviews:number}[];pages:{name:string;views:number;visitors:number}[];filters:{area:string|null;category:string|null;radius_km:number;uses:number}[];categories:Category[];places:{name:string;visitors:number;searches:number}[];events:EventStats[]};
const number=(n:number)=>new Intl.NumberFormat('nl-NL').format(n);
export default function AnalyticsDashboard({client}:{client:SupabaseClient|null}){
  const [days,setDays]=useState(30),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [eventFilter,setEventFilter]=useState('');
  const requestId=useRef(0);
  const load=useCallback(async()=>{
    if(!client)return;const id=++requestId.current;setLoading(true);setError('');setReport(null);
    try{const {data,error}=await client.rpc('site_analytics_report',{p_days:days});
      if(error)throw new Error(error.code==='PGRST202'?'Analytics is nog niet geactiveerd in deze database. De databasemigratie ontbreekt.':`Statistieken ophalen mislukt: ${error.message}`);
      if(id===requestId.current)setReport(data as Report);
    }catch(cause){if(id===requestId.current)setError(cause instanceof Error?cause.message:'Statistieken zijn tijdelijk niet beschikbaar.');}finally{if(id===requestId.current)setLoading(false);}
  },[client,days]);
  useEffect(()=>{void load();},[load]);
  const events=report?.events.filter(e=>e.name?.toLocaleLowerCase('nl').includes(eventFilter.toLocaleLowerCase('nl')))??[];
  function download(){
    if(!report)return;
    const rows:unknown[][]=[['Côte de Duras — gemeten bereik met toestemming'],['Periode (dagen)',days],['Gegenereerd',report.generatedAt],['Bezoekers',report.summary.visitors],['Bezoeken',report.summary.visits],[],
      ['Paginaweergaven',report.summary.pageviews],['Maand','Bezoekers','Bezoeken','Paginaweergaven'],...report.monthly.map(m=>[m.month,m.visitors,m.visits,m.pageviews]),[],
      ['Pagina','Weergaven','Bezoekers'],...report.pages.map(p=>[p.name,p.views,p.visitors]),[],
      ['Filterplaats','Categorie','Afstand (km)','Toepassingen'],...report.filters.map(f=>[f.area??'Huidige locatie',f.category??'Alle categorieën',f.radius_km,f.uses]),[],
      ['Dag','Bezoekers','Bezoeken'],...report.daily.map(d=>[d.day,d.visitors,d.visits]),[],
      ['Plaats','Bezoekers','Keuzes'],...report.places.map(p=>[p.name,p.visitors,p.searches]),[],
      ['Categorie','Bezoekers','Bezoeken','Categoriekeuzes','Evenementweergaven','Doorklikken'],...report.categories.map(c=>[c.name,c.visitors,c.visits,c.selections,c.views,c.clicks]),[],
      ['Evenement','Zichtbare vermeldingen','Geopend','Doorklikken','Reserveringsklikken','Bereikte bezoeken','Bezoeken met doorklik na vertoning'],...events.map(e=>[e.name,e.impressions,e.views,e.clicks,e.bookings,e.reached_sessions,e.clicked_sessions]),[],
      ['Toelichting','Uitsluitend gemeten bezoeken met toestemming; geen historische reconstructie, volledige personentelling of bevestigde boekingen.']];
    const safe=(value:unknown)=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`cote-de-duras-bereik-${days}-dagen.csv`;a.click();URL.revokeObjectURL(url);
  }
  return <section className="analytics-dashboard" aria-labelledby="analytics-title">
    <h2 id="analytics-title">Bezoekers & advertentiebereik</h2>
    <p>Echte gemeten bezoeken met toestemming. Beheerders worden op deze pagina uitgesloten. Een bezoeker is een browsercode, geen gegarandeerd unieke persoon. Categorieën kunnen overlappen; tel hun bezoekers niet bij elkaar op.</p>
    <div className="analytics-controls"><label>Periode <select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,365].map(d=><option key={d} value={d}>Laatste {d} dagen</option>)}</select></label><button type="button" onClick={()=>void load()} disabled={loading}>Vernieuwen</button><button type="button" onClick={download} disabled={!report||loading}>Rapport downloaden (CSV)</button></div>
    {loading&&<p role="status">Statistieken laden…</p>}{error&&<p role="alert">{error}</p>}
    {report&&<>
      <p>Oudste bewaarde meting: {report.firstMeasuredAt?new Date(report.firstMeasuredAt).toLocaleDateString('nl-NL'):'nog geen metingen'}. Totaal gemeten bezoekers binnen de bewaartermijn van 13 maanden: <strong>{number(report.totalMeasuredVisitors)}</strong>.</p>
      <div className="analytics-kpis">{[['Bezoekers',report.summary.visitors],['Bezoeken',report.summary.visits],['Paginaweergaven',report.summary.pageviews],['Evenementen geopend',report.summary.views],['Zichtbare vermeldingen',report.summary.impressions],['Doorklikken',report.summary.clicks]].map(([label,value])=><div key={label}><span>{label}</span><strong>{number(Number(value))}</strong></div>)}</div>
      {!report.summary.visits&&<p>Er zijn nog geen gemeten bezoeken in deze periode. Cijfers worden vanaf ingebruikname opgebouwd; er zijn geen voorbeeldcijfers toegevoegd.</p>}
      <h3>Bezoekers per dag</h3>
      <div className="analytics-chart" aria-label="Gemeten bezoekers per dag">{report.daily.map(day=><div key={day.day} title={`${day.day}: ${day.visitors} bezoekers, ${day.visits} bezoeken`}><span style={{height:Math.max(3,day.visitors/Math.max(1,...report.daily.map(d=>d.visitors))*100)}}/><small>{day.day.slice(5)}</small><b>{day.visitors}</b></div>)}</div>
      <h3>Ontwikkeling per maand</h3><div className="analytics-table"><table><thead><tr><th>Maand</th><th>Bezoekers</th><th>Bezoeken</th><th>Paginaweergaven</th></tr></thead><tbody>{report.monthly.map(m=><tr key={m.month}><th>{m.month}</th><td>{number(m.visitors)}</td><td>{number(m.visits)}</td><td>{number(m.pageviews)}</td></tr>)}</tbody></table></div>
      <h3>Bezochte pagina’s</h3><p>De agenda is één pagina. Openingen van evenementdetails staan afzonderlijk bij evenementen.</p><div className="analytics-table"><table><thead><tr><th>Pagina</th><th>Weergaven</th><th>Bezoekers</th></tr></thead><tbody>{report.pages.map(p=><tr key={p.name}><th>{p.name==='/'?'Agenda':p.name}</th><td>{number(p.views)}</td><td>{number(p.visitors)}</td></tr>)}</tbody></table></div>
      <h3>Plaats-, categorie- en afstandsfilters</h3><p>Inclusief de toegepaste beginselectie; geen vrije zoektekst of precieze locatie opgeslagen.</p><div className="analytics-table"><table><thead><tr><th>Plaats</th><th>Categorie</th><th>Afstand</th><th>Toepassingen</th></tr></thead><tbody>{report.filters.map((f,i)=><tr key={i}><th>{f.area??'Huidige locatie'}</th><td>{f.category??'Alle categorieën'}</td><td>{f.radius_km} km</td><td>{number(f.uses)}</td></tr>)}</tbody></table></div>
      <h3>Bereik per categorie</h3><div className="analytics-table"><table><thead><tr>{['Categorie','Bezoekers','Bezoeken','Gekozen','Geopend','Doorklikken'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{report.categories.map(c=><tr key={c.name}><th>{c.name}</th>{[c.visitors,c.visits,c.selections,c.views,c.clicks].map((n,i)=><td key={i}>{number(n)}</td>)}</tr>)}</tbody></table></div>
      <h3>Gezochte plaatsen</h3><div className="analytics-table"><table><thead><tr><th>Plaats</th><th>Bezoekers</th><th>Keuzes</th></tr></thead><tbody>{report.places.map(p=><tr key={p.name}><th>{p.name}</th><td>{number(p.visitors)}</td><td>{number(p.searches)}</td></tr>)}</tbody></table></div>
      <h3>Evenementen & resultaten voor adverteerders</h3><label>Zoek evenement <input value={eventFilter} onChange={e=>setEventFilter(e.target.value)} placeholder="Naam evenement"/></label>
      <p>Een zichtbare vermelding telt eenmaal per bezoek en plaatsing, na 1 seconde met minstens 50% van de kaart in beeld. Klikratio: aandeel bereikte bezoeken dat daarna naar een externe link doorklikte. Reserveringsklikken zijn geen bevestigde boekingen.</p>
      <div className="analytics-table"><table><thead><tr>{['Evenement','Bereikte bezoeken','Vermeldingen','Geopend','Doorklikken','Reserveringsklikken','Klikratio'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{events.map(e=><tr key={e.event_id}><th>{e.name}</th><td>{number(e.reached_sessions)}</td><td>{number(e.impressions)}</td><td>{number(e.views)}</td><td>{number(e.clicks)}</td><td>{number(e.bookings)}</td><td>{e.reached_sessions?(100*e.clicked_sessions/e.reached_sessions).toFixed(1)+'%':'—'}</td></tr>)}</tbody></table></div>
      <p><small>Bijgewerkt: {new Date(report.generatedAt).toLocaleString('nl-NL')}. Alleen geaggregeerde cijfers delen met adverteerders; geen bezoekersprofielen.</small></p>
    </>}
  </section>;
}
