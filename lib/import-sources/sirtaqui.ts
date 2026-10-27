import { parseSirtaquiCsv, sirtaquiLocalTimestamp, sirtaquiCategories } from "../sirtaqui";
import { distanceInKm } from "../local-area";
import catalog from "../data/area-catalog.json";
import snapshot from "../data/sirtaqui-events.json";
import type { ImportedEvent } from "../tourisme-duras";

export type SirtaquiEvent = ImportedEvent & { category_slugs: string[]; source_id: string };
export async function fetchSirtaquiEvents(now=new Date(), departments=["24","33","47"]): Promise<SirtaquiEvent[]> {
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const results=await Promise.all(departments.map(async department=>{
    const source=`https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-${department}.csv`;
    try {
      const response=await fetch(source,{cache:"no-store",signal:AbortSignal.timeout(20_000)});
      if(!response.ok) throw new Error(`SIRTAQUI ${department}: HTTP ${response.status}`);
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength>20_000_000) throw new Error("Onverwacht groot agendabestand.");
      const rows=parseSirtaquiCsv(new TextDecoder("windows-1252").decode(bytes));
      if(!rows.length || !rows[0]["IDENTIFIANT SIRTAQUI"]) throw new Error("Het agendaformaat is gewijzigd.");
      return rows.flatMap(row=>{
        const latitude=Number(row.LATITUDE),longitude=Number(row.LONGITUDE);
        if(!row.LATITUDE||!row.LONGITUDE||!catalog.areas.some(area=>distanceInKm(area.latitude,area.longitude,latitude,longitude)<=area.radius_km)) return [];
        return row.DATES.split(/\s+#\s+/).flatMap(period=>{
          const [startDate,endDate,from,until]=period.split("|");
          const start_at=sirtaquiLocalTimestamp(startDate,from||"10:00"),end_at=sirtaquiLocalTimestamp(endDate||startDate,until||"23:59");
          if(!start_at||!end_at||end_at.slice(0,10)<today||new Date(end_at)<new Date(start_at)) return [];
          const id=row["IDENTIFIANT SIRTAQUI"],category_slugs=sirtaquiCategories(row);
          const slug=`${row.NOM_OFFRE}-${start_at.slice(0,10)}-${id}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
          return [{source_id:id,category_slugs,title:row.NOM_OFFRE,slug,short_description:row.DESCRIPTIF.slice(0,250)||null,description:`${row.DESCRIPTIF||''}\n\nBron: SIRTAQUI — CRT Nouvelle-Aquitaine. Bron bijgewerkt: ${row.DATE_DERNIERE_MAJ||'niet vermeld'}.`.trim(),
            start_at,end_at,venue_name:row.LIEU||null,address:row.ADRESSE||null,postcode:row.CODE_POSTAL||null,city:row.COMMUNE||null,latitude,longitude,
            price_from:null,price_to:null,is_free:/^gratuit\b/i.test(row.TARIFS),website_url:row.SITE_WEB.split(" # ")[0]||null,booking_url:null,
            contact_phone:row.TEL||null,image_url:null,organizer_name:row.ORGANISATEUR||null,source_category:row.CATEGORIE||row.TYPE,
            source_url:`${source}#${id}-${start_at.slice(0,10)}`,status:"pending" as const,verified:false as const}];
        });
      });
    } catch(error) {
      // Keep the last successfully downloaded source when its publisher is
      // temporarily offline. Never roll past dates forward into another year.
      console.error(`[sirtaqui-${department}]`,error instanceof Error?error.message:error);
      const age=now.getTime()-new Date(snapshot.updatedAt).getTime();
      if(age>7*24*60*60*1000) throw error;
      return snapshot.events.filter(event=>event.source_url.startsWith(source) && event.end_at.slice(0,10)>=today) as SirtaquiEvent[];
    }
  }));
  return [...new Map(results.flat().map(event=>[event.source_url,event])).values()];
}
