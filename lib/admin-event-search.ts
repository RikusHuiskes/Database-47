type SearchableEvent={title:string;status?:string;category_ids?:string[]};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ').trim();

export function searchAdminEvents<T extends SearchableEvent>(events:T[],name:string,category:string,status:'pending'|'all',requestedPage:number,pageSize=25){
  const words=normalize(name).split(/\s+/).filter(Boolean);
  const matches=events.filter(event=>
    (status==='all'||event.status?.toLowerCase()==='pending')
    && words.every(word=>normalize(event.title).includes(word))
    && (category==='all'||(category==='none'?!event.category_ids?.length:event.category_ids?.includes(category)===true))
  );
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));
  const page=Math.max(1,Math.min(pages,requestedPage));
  return {total:matches.length,pages,page,items:matches.slice((page-1)*pageSize,page*pageSize),from:matches.length?(page-1)*pageSize+1:0,to:Math.min(page*pageSize,matches.length)};
}
