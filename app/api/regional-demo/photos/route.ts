import {regionalCatalog as d} from '../../../../lib/regional-demo';

export function GET(){
 const labels:Record<string,string>={source_verified:'Bronfoto gecontroleerd',provider_verified:'Foto van bijpassende aanbiederspagina',source_without_photo:'Bron bevat geen foto',source_unreachable:'Bronfoto niet bereikbaar',source_record_unavailable:'Bronvermelding niet meer beschikbaar'};
 const rows=[['Website','Categorie','Vermelding','Plaats','Fotostatus','Foto','Bron van de foto','Oorspronkelijke bron','Gecontroleerd op'],...d.events.map(e=>[d.brand,e.category_ids.map(id=>d.categories.find(c=>c.id===id)?.name||'').join('; '),e.title,e.city,labels[String(e.photo_status)]||'Niet gecontroleerd',e.image_url,e.photo_source_url,e.source_url,e.photo_checked_at])];
 const text='\ufeff'+rows.map(row=>row.map(value=>{let v=String(value??'');if(/^[=+@\t\r-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}).join(';')).join('\r\n');
 return new Response(text,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename="${d.key}-fotocontrole.csv"`,'Cache-Control':'no-store'}});
}
