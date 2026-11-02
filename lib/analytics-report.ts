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

export function analyticsRows(report:AnalyticsReport, days:number,translate:(text:string)=>string=text=>text) {
  const labels=(...values:string[])=>values.map(translate);
  const rows:unknown[][]=[labels('Côte de Duras — gemeten bereik met toestemming'),[translate('Periode (dagen)'),days],[translate('Gegenereerd'),report.generatedAt],[translate('Bezoekers'),report.summary.visitors],[translate('Bezoeken'),report.summary.visits],[translate('Paginaweergaven'),report.summary.pageviews],[translate('Evenementen geopend'),report.summary.views],[translate('Zichtbare vermeldingen'),report.summary.impressions],[translate('Doorklikken'),report.summary.clicks],[],
    labels('Maand','Bezoekers','Bezoeken','Paginaweergaven'),...report.monthly.map(m=>[m.month,m.visitors,m.visits,m.pageviews]),[],
    labels('Pagina','Weergaven','Bezoekers'),...report.pages.map(p=>[p.name,p.views,p.visitors]),[],
    labels('Filterplaats','Categorie','Afstand (km)','Toepassingen'),...report.filters.map(f=>[f.area??translate('Huidige locatie'),f.category?translate(f.category):translate('Alle categorieën'),f.radius_km,f.uses]),[],
    labels('Dag','Bezoekers','Bezoeken'),...report.daily.map(d=>[d.day,d.visitors,d.visits]),[],
    labels('Plaats','Bezoekers','Keuzes'),...report.places.map(p=>[p.name,p.visitors,p.searches]),[],
    labels('Categorie','Bezoekers','Bezoeken','Categoriekeuzes','Evenementweergaven','Doorklikken'),...report.categories.map(c=>[translate(c.name),c.visitors,c.visits,c.selections,c.views,c.clicks]),[],
    labels('Evenement','Zichtbare vermeldingen','Geopend','Doorklikken','Reserveringsklikken','Bereikte bezoeken','Bezoeken met doorklik na vertoning'),...report.events.map(e=>[e.name,e.impressions,e.views,e.clicks,e.bookings,e.reached_sessions,e.clicked_sessions]),[],
    labels('Toelichting','Uitsluitend gemeten bezoeken met toestemming; geen historische reconstructie, volledige personentelling of bevestigde boekingen.')];
  return rows;
}

export function analyticsCsv(report:AnalyticsReport,days:number,translate:(text:string)=>string=text=>text) {
  const rows=analyticsRows(report,days,translate);
  const safe=(value:unknown)=>'"'+String(value??'').replace(/^(\s*[=+@-]|[\t\r\n])/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n');
}
