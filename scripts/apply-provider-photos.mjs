import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),cache=new URL('work/photo-audit/',root);
const accepted=JSON.parse(await fs.readFile(new URL('accepted-provider-photos.json',cache),'utf8'));
for(const key of ['libourne','sarlat']){
 const path=new URL(`lib/regions/${key}.json`,root),d=JSON.parse(await fs.readFile(path,'utf8'));
 for(const photo of accepted.filter(p=>p.key===key&&p.reviewed)){
  const e=d.events.find(e=>e.id===photo.id);if(!e||e.title!==photo.title||e.image_url)continue;
  e.image_url=photo.image_url;e.photo_source_url=photo.photo_source_url;e.photo_origin_url=photo.original_image_url;e.photo_evidence_title=photo.evidence_title;e.photo_status='provider_verified';e.photo_checked_at=photo.checkedAt;
 }
 const withPhoto=d.events.filter(e=>e.image_url).length;
 d.photoAudit={...d.photoAudit,withPhoto,missing:d.events.length-withPhoto,providerPhotos:d.events.filter(e=>e.photo_status==='provider_verified').length};
 await fs.writeFile(path,JSON.stringify(d));console.log(key,JSON.stringify(d.photoAudit));
}
