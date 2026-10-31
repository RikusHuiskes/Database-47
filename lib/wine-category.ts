export function isWineTasting(event:{title?:string|null;description?:string|null;short_description?:string|null;source_category?:string|null}){
  const text=[event.title,event.description,event.short_description,event.source_category].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const title=(event.title??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/(?:ateliers?|cours) de cuisine/.test(title))return false;
  if(/\bbeaujolais nouveau\b/.test(title))return true;
  return /degustation|wine tasting|wijnproeverij/.test(text)&&(/\b(vins?|vinif\w*|vignobles?|vignes?|vigneron\w*|viticol\w*|viticul\w*|chais?|cepages?|oenolog\w*|wine|wijn|pecharmant|monbazillac|montravel|saussignac)\b/.test(text)||/degustation.{0,50}(?:vieux\s+)?millesimes?/.test(text));
}
