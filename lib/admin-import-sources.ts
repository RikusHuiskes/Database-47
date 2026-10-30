export const IMPORT_SOURCES = [
  {endpoint:'/api/import-tourisme-duras',name:'Tourisme Duras'},
  {endpoint:'/api/import-eymet',name:'Eymet-agenda'},
  {endpoint:'/api/import-sirtaqui',name:'Alle streekagenda’s'},
  {endpoint:'/api/import-openagenda',name:'Nationale agenda'},
  ...[['marmande','Marmande'],['miramont','Miramont-de-Guyenne'],['pineuilh','Pineuilh'],['sainte-foy','Sainte-Foy-la-Grande']].map(([source,name])=>({endpoint:`/api/import-regional-agendas?source=${source}`,name})),
  ...[['24','Dordogne'],['33','Gironde'],['47','Lot-et-Garonne']].map(([department,name])=>({endpoint:`/api/import-sirtaqui?department=${department}`,name})),
];
// Broad endpoints already include the individual towns and departments.
export const ALL_IMPORT_SOURCES = [...IMPORT_SOURCES.slice(0,4),{endpoint:'/api/import-regional-agendas',name:'Gemeentelijke agenda’s'}];
export async function fetchImportPreview<T>(sources:readonly {endpoint:string;name:string}[],fetcher:typeof fetch=fetch,onProgress:(name:string)=>void=()=>{}){
  const events:T[]=[];
  for(const source of sources){
    onProgress(source.name);
    const response=await fetcher(source.endpoint,{cache:'no-store',signal:AbortSignal.timeout(300000)});
    if(!response.ok)throw Error(`${source.name}: ophalen mislukt (HTTP ${response.status}). Probeer deze bron afzonderlijk opnieuw.`);
    const data=await response.json();
    if(!Array.isArray(data.events))throw Error(`${source.name}: de bron gaf geen geldige evenementenlijst terug.`);
    events.push(...data.events);
  }
  return events;
}
