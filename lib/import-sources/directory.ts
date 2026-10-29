import {parseSirtaquiCsv,sirtaquiPhotoUrl} from '../sirtaqui';
import {distanceInKm,normalizePlaceName} from '../local-area';
import catalog from '../data/area-catalog.json';
import snapshot from '../data/directory-entries.json';
const feeds=[['hotels','hotels-chambres-hotes-gites'],['chambres-hotes','hotels-chambres-hotes-gites'],['meubles-classes','hotels-chambres-hotes-gites'],['meubles-labellises','hotels-chambres-hotes-gites'],['meubles-non-classes-non-labellises','hotels-chambres-hotes-gites'],['sites-viticoles','wijnhuizen'],['sites-sorties','cafes'],['points-restauration','cafes']];
export type DirectoryEntry={source_id:string;category_slug:string;title:string;city:string|null;postcode:string|null;address:string|null;latitude:number|null;longitude:number|null;short_description:string|null;description:string;website_url:string|null;contact_phone:string|null;image_url:string|null;source_url:string};
export function directoryFeedEntries(csv:string,category_slug:string,url:string):DirectoryEntry[]{
 const rows=parseSirtaquiCsv(csv);if(!rows.length||!('IDENTIFIANT SIRTAQUI' in rows[0]))throw Error('Het bronformaat is gewijzigd.');
 return rows.flatMap(row=>{
  const normalized=normalizePlaceName(`${row.NOM_OFFRE} ${row.TYPE??''} ${row.CATEGORIE??''}`);
  if(category_slug==='cafes'&&!/\b(cafe|bar|pub|bistrot|salon de the)\b/.test(normalized))return [];
  const latitude=row.LATITUDE?Number(row.LATITUDE):NaN,longitude=row.LONGITUDE?Number(row.LONGITUDE):NaN;
  const relevant=catalog.areas.some(area=>normalizePlaceName(area.name)===normalizePlaceName(row.COMMUNE??'')||Number.isFinite(latitude)&&Number.isFinite(longitude)&&distanceInKm(area.latitude,area.longitude,latitude,longitude)<=area.radius_km);
  if(!relevant||!row.NOM_OFFRE||!row['IDENTIFIANT SIRTAQUI'])return [];
  return [{source_id:row['IDENTIFIANT SIRTAQUI'],category_slug,title:row.NOM_OFFRE,city:row.COMMUNE||null,postcode:row.CODE_POSTAL||null,address:[row.BATIMENT_RESIDENCE,row.RUE,row.LIEUDIT_BP,row.ADRESSE].filter(Boolean).join(', ')||null,latitude:Number.isFinite(latitude)?latitude:null,longitude:Number.isFinite(longitude)?longitude:null,short_description:row.DESCRIPTIF?.slice(0,250)||null,description:[row.DESCRIPTIF,`Bron: SIRTAQUI — CRT Nouvelle-Aquitaine. Bron bijgewerkt: ${row.DATE_DERNIERE_MAJ||'niet vermeld'}.`].filter(Boolean).join('\n\n'),website_url:row.SITE_WEB?.split(' # ')[0]||null,contact_phone:row.TEL?.split(' # ')[0]||null,image_url:sirtaquiPhotoUrl(row.PHOTOS),source_url:`${url}#${row['IDENTIFIANT SIRTAQUI']}`}];
 });
}
export async function fetchDirectoryEntries(now=new Date(),fetcher:typeof fetch=fetch){
 const entries:DirectoryEntry[]=[],sources:{url:string;count:number;fallback:boolean;error?:string}[]=[];
 for(const [feed,category] of feeds){
  const url=`https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-${feed}.csv`;
  try{const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const bytes=await response.arrayBuffer();if(bytes.byteLength>25000000)throw Error('Bronbestand te groot.');const selected=directoryFeedEntries(new TextDecoder('windows-1252').decode(bytes),category,url);entries.push(...selected);sources.push({url,count:selected.length,fallback:false});}
  catch(error){if(now.getTime()-Date.parse(snapshot.updatedAt)>7*86400000)throw Error('De bron is onbereikbaar en de reservekopie is te oud: '+url);const cached=snapshot.entries.filter(entry=>entry.source_url.startsWith(url+'#'));entries.push(...cached);sources.push({url,count:cached.length,fallback:true,error:error instanceof Error?error.message:'Bron onbereikbaar'});}
 }
 // Existing map supplements remain additive; a failed live feed cannot erase
 // records or relabel existing admin edits.
 entries.push(...snapshot.entries.filter(entry=>entry.source_url.startsWith('https://www.openstreetmap.org/')));
 return {entries:[...new Map(entries.map(entry=>[entry.source_id,entry])).values()],sources};
}
