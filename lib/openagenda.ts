import { sirtaquiCategories } from "./sirtaqui.ts";
import { distanceInKm } from "./local-area.ts";
type Area={latitude:number;longitude:number;radius_km:number};
type RecordData=Record<string,any>;
export function parseOpenAgendaEvents(rows:RecordData[],areas:Area[],now=new Date()) {
  const events:RecordData[]=[];
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  for(const row of rows){
    const latitude=Number(row.location_coordinates?.lat),longitude=Number(row.location_coordinates?.lon);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!areas.some(area=>distanceInKm(area.latitude,area.longitude,latitude,longitude)<=area.radius_km))continue;
    let source:URL;try{source=new URL(row.canonicalurl);}catch{continue;}
    if(source.protocol!=="https:"||source.hostname!=="openagenda.com"||!source.pathname.includes("/events/")||!row.title_fr)continue;
    let timings:RecordData[];try{timings=typeof row.timings==="string"?JSON.parse(row.timings):row.timings;}catch{continue;}
    let status:RecordData;try{status=typeof row.status==="string"?JSON.parse(row.status):row.status;}catch{status={};}
    if(status?.id===2 || /annul[eé]/i.test(status?.label?.fr??""))continue;
    if(!Array.isArray(timings))continue;
    const keywords=Array.isArray(row.keywords_fr)?row.keywords_fr.join(" # "):String(row.keywords_fr??"");
    const category_slugs=sirtaquiCategories({NOM_OFFRE:row.title_fr,CATEGORIE:keywords,TYPE:String(row.category??""),THEME:keywords});
    const description=String(row.longdescription_fr||row.description_fr||"").replace(/<br\s*\/?\s*>|<\/p>/gi,"\n").replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim();
    for(const timing of timings){
      if(!timing.begin||!timing.end||!Number.isFinite(Date.parse(timing.begin))||!Number.isFinite(Date.parse(timing.end))||Date.parse(timing.end)<Date.parse(timing.begin))continue;
      const finalDay=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(timing.end));
      if(finalDay<today)continue;
      const start_at=new Date(timing.begin).toISOString(),end_at=new Date(timing.end).toISOString();
      const source_url=`${source.origin}${source.pathname}#database47-${start_at}`;
      const slug=`${row.title_fr}-${row.uid}-${start_at}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      events.push({title:row.title_fr,slug,start_at,end_at,description:description+(row.conditions_fr?`\n\n${row.conditions_fr}`:"")+(row.imagecredits?`\n\nFotocredit: ${row.imagecredits}`:""),short_description:String(row.description_fr??description).slice(0,250)||null,
        venue_name:row.location_name||null,address:row.location_address||null,postcode:row.location_postalcode||null,city:row.location_city||null,latitude,longitude,
        website_url:row.location_website||null,booking_url:null,contact_phone:row.location_phone||null,image_url:row.image||null,organizer_name:row.originagenda_title||null,
        price_from:null,price_to:null,is_free:/\bgratuit|entree libre\b/i.test(String(row.conditions_fr??"")),source_category:keywords||null,source_url,category_slugs,status:"pending",verified:false});
    }
  }
  return [...new Map(events.map(event=>[event.source_url,event])).values()];
}
export async function fetchOpenAgendaEvents(areas:Area[],now=new Date()) {
  const day=now.toISOString().slice(0,10);
  const where=`lastdate_end >= date'${day}' AND (location_department = 'Dordogne' OR location_department = 'Gironde' OR location_department = 'Lot-et-Garonne')`;
  const page=async(offset:number)=>{
    const params=new URLSearchParams({where,limit:"100",offset:String(offset),order_by:"uid"});
    const response=await fetch(`https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records?${params}`,{cache:"no-store",signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error(`OpenAgenda: HTTP ${response.status}`);
    return response.json() as Promise<{total_count:number;results:RecordData[]}>;
  };
  const first=await page(0),rows=[...first.results];
  if(first.total_count>10000)throw new Error("De nationale agenda moet verder per gebied worden verdeeld.");
  let offset=100;
  await Promise.all(Array.from({length:3},async()=>{while(offset<first.total_count){const current=offset;offset+=100;rows.push(...(await page(current)).results);}}));
  return {events:parseOpenAgendaEvents(rows,areas,now),recordsChecked:rows.length,updatedAt:now.toISOString()};
}
