export type MarketingRow={name:string;visits:number;visitors:number;engaged:number;details:number;outbound:number;bookings:number;advertising:number;checkouts:number};
export type MarketingReport={startedAt:string|null;returningVisitors:number;
 summary:{visits:number;visitors:number;attributed:number;countryKnown:number;engaged:number;details:number;outbound:number;bookings:number;advertising:number;checkouts:number};
 previous:{visits:number;visitors:number;engaged:number;outbound:number;bookings:number};
 channels?:MarketingRow[];sources?:MarketingRow[];campaigns?:MarketingRow[];variants?:MarketingRow[];referrers?:MarketingRow[];countries?:MarketingRow[];devices?:MarketingRow[];languages?:MarketingRow[];landings?:MarketingRow[];
};
export type AnalyticsReport = {
  marketing?:MarketingReport;
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
  if(report.marketing){const m=report.marketing;
    rows.push([],labels('Marketing & herkomst'),[translate('Herkomst gemeten vanaf'),m.startedAt??''],[translate('Bezoeken met herkomstmeting'),m.summary.attributed],[translate('Betrokken bezoeken'),m.summary.engaged],[translate('Terugkerende bezoekers'),m.returningVisitors],[],labels('Vorige periode: bezoeken, bezoekers, betrokken, externe klik, reserveringsklik'),[m.previous.visits,m.previous.visitors,m.previous.engaged,m.previous.outbound,m.previous.bookings]);
    for(const [key,label]of [['channels','Kanalen'],['sources','Bron / medium'],['campaigns','Campagnes'],['variants','Advertentievarianten'],['referrers','Verwijzende websites'],['countries','Landen'],['devices','Apparaten'],['languages','Talen'],['landings','Landingspagina’s']] as const){
      rows.push([],labels(label,'Bezoeken','Bezoekers','Betrokken bezoeken','Bezoeken met detailweergave','Bezoeken met externe klik','Bezoeken met reserveringsklik','Interesse in adverteren','Betaalproces gestart'),...(m[key]??[]).map(r=>[translate(({unmeasured:'Niet gemeten vóór uitbreiding',direct:'Direct / onbekend',organic_social:'Sociale media',organic_search:'Zoekmachines',paid_social:'Betaalde sociale media',paid_search:'Betaalde zoekmachines',paid_other:'Overig betaald verkeer',email:'E-mail / nieuwsbrief',referral:'Verwijzende websites'} as Record<string,string>)[r.name]??r.name),r.visits,r.visitors,r.engaged,r.details,r.outbound,r.bookings,r.advertising,r.checkouts]));
    }
    rows.push([],labels('Betrokken betekent: evenementdetails geopend of een externe link aangeklikt. Klikken en gestarte betalingen zijn geen bevestigde boekingen of omzet. Direct/onbekend kan ook een afgeschermde verwijzer zijn. Oudere bezoeken krijgen geen verzonnen bron.'));
  }
  return rows;
}

export function analyticsCsv(report:AnalyticsReport,days:number,translate:(text:string)=>string=text=>text) {
  const rows=analyticsRows(report,days,translate);
  const safe=(value:unknown)=>'"'+String(value??'').replace(/^(\s*[=+@-]|[\t\r\n])/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n');
}
