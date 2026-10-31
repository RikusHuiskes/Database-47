export type AnalyticsReport = {
  generatedAt:string; firstMeasuredAt:string|null; totalMeasuredVisitors:number;
  summary:{visitors:number;visits:number;pageviews:number;views:number;impressions:number;clicks:number};
  daily:{day:string;visitors:number;visits:number}[];
  monthly:{month:string;visitors:number;visits:number;pageviews:number}[];
  pages:{name:string;views:number;visitors:number}[];
  filters:{area:string|null;category:string|null;radius_km:number;uses:number}[];
  categories:{name:string;visitors:number;visits:number;selections:number;views:number;clicks:number}[];
  places:{name:string;visitors:number;searches:number}[];
  events:{event_id:string;name:string;impressions:number;views:number;clicks:number;bookings:number;visitors:number;reached_sessions:number;clicked_sessions:number}[];
};

export function analyticsCsv(report:AnalyticsReport, days:number) {
  const rows:unknown[][]=[['Côte de Duras — gemeten bereik met toestemming'],['Periode (dagen)',days],['Gegenereerd',report.generatedAt],['Bezoekers',report.summary.visitors],['Bezoeken',report.summary.visits],['Paginaweergaven',report.summary.pageviews],['Evenementen geopend',report.summary.views],['Zichtbare vermeldingen',report.summary.impressions],['Doorklikken',report.summary.clicks],[],
    ['Maand','Bezoekers','Bezoeken','Paginaweergaven'],...report.monthly.map(m=>[m.month,m.visitors,m.visits,m.pageviews]),[],
    ['Pagina','Weergaven','Bezoekers'],...report.pages.map(p=>[p.name,p.views,p.visitors]),[],
    ['Filterplaats','Categorie','Afstand (km)','Toepassingen'],...report.filters.map(f=>[f.area??'Huidige locatie',f.category??'Alle categorieën',f.radius_km,f.uses]),[],
    ['Dag','Bezoekers','Bezoeken'],...report.daily.map(d=>[d.day,d.visitors,d.visits]),[],
    ['Plaats','Bezoekers','Keuzes'],...report.places.map(p=>[p.name,p.visitors,p.searches]),[],
    ['Categorie','Bezoekers','Bezoeken','Categoriekeuzes','Evenementweergaven','Doorklikken'],...report.categories.map(c=>[c.name,c.visitors,c.visits,c.selections,c.views,c.clicks]),[],
    ['Evenement','Zichtbare vermeldingen','Geopend','Doorklikken','Reserveringsklikken','Bereikte bezoeken','Bezoeken met doorklik na vertoning'],...report.events.map(e=>[e.name,e.impressions,e.views,e.clicks,e.bookings,e.reached_sessions,e.clicked_sessions]),[],
    ['Toelichting','Uitsluitend gemeten bezoeken met toestemming; geen historische reconstructie, volledige personentelling of bevestigde boekingen.']];
  const safe=(value:unknown)=>'"'+String(value??'').replace(/^(\s*[=+@-]|[\t\r\n])/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n');
}
