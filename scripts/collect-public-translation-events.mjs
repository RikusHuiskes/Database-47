import fs from 'node:fs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url||!key)throw Error('Public Supabase configuration is required');
let last='',rows=[];
for(let page=0;page<100;page++){
 const params=new URLSearchParams({select:'id,title,description,short_description,is_directory_entry,start_at,city,venue_name',status:'eq.approved',verified:'eq.true',municipal_key:'is.null',order:'id.asc',limit:'1000'});
 if(last)params.set('id','gt.'+last);
 const response=await fetch(url+'/rest/v1/events?'+params,{headers:{apikey:key,Authorization:'Bearer '+key}});
 if(!response.ok)throw Error('Public listing download failed: '+response.status);
 const data=await response.json();if(!Array.isArray(data))throw Error('Unexpected public listing response');rows.push(...data);if(data.length<1000)break;last=data.at(-1).id;
}
if(!rows.length)throw Error('Refusing to replace the source with an empty listing set');
fs.mkdirSync('work/translations',{recursive:true});fs.writeFileSync('work/translations/events.json',JSON.stringify({events:rows,collectedAt:new Date().toISOString()}));console.log('Public approved calendar records:',rows.length);
