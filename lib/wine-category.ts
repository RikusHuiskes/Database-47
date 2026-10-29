export function isWineTasting(event:{title?:string|null;description?:string|null;short_description?:string|null;source_category?:string|null}){
  const text=[event.title,event.description,event.short_description,event.source_category].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /degustation|wine tasting|wijnproeverij/.test(text)&&/\b(vins?|vignobles?|vignes?|chais?|cepages?|oenolog\w*|wine|wijn)\b/.test(text);
}
