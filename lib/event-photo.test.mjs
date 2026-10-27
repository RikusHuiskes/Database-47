import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as photoHelpers from './event-photo.ts';
import {eventPhotoType, isEventPhoto} from './event-photo.ts';

test('JPG, PNG and WebP work with regular, missing and generic file-picker MIME types', () => {
  for (const [name, expected] of [['été.JPG','image/jpeg'],['photo.jpeg','image/jpeg'],['photo.PNG','image/png'],['photo.WebP','image/webp']]) {
    for (const type of [expected, '', 'application/octet-stream']) {
      assert.equal(eventPhotoType({name,type}), expected);
    }
  }
  assert.equal(eventPhotoType({name:'photo.jpg',type:'image/pjpeg'}),'image/jpeg');
  assert.equal(eventPhotoType({name:'photo.jpg',type:'image/jpg'}),'image/jpeg');
});

test('Unsupported and disguised files remain rejected', () => {
  assert.equal(eventPhotoType({name:'photo.svg',type:''}),null);
  assert.equal(eventPhotoType({name:'photo.jpg',type:'text/html'}),null);
  assert.equal(eventPhotoType({name:'photo.jpg.exe',type:''}),null);
  for (const type of ['image/jpeg','image/png','image/webp']) {
    assert.equal(isEventPhoto(type,new TextEncoder().encode('<script>bad</script>')),false);
    assert.equal(isEventPhoto(type,new Uint8Array()),false);
  }
});

test('Storage content type must match image bytes', () => {
  const jpg=Uint8Array.from([255,216,255]);
  const png=Uint8Array.from([137,80,78,71,13,10,26,10]);
  const webp=new TextEncoder().encode('RIFF1234WEBP');
  assert.equal(isEventPhoto('image/jpeg',jpg),true);
  assert.equal(isEventPhoto('image/png',png),true);
  assert.equal(isEventPhoto('image/webp',webp),true);
  assert.equal(isEventPhoto('image/png',jpg),false);
  assert.equal(isEventPhoto('image/webp',png),false);
  assert.equal(isEventPhoto('image/jpeg',webp),false);
});

// Execute the actual route with only Supabase replaced, so tests exercise its
// multipart handling, byte validation, bucket checks and upload options.
function routeWith(client) {
  const source=readFileSync(new URL('../app/api/visitor-event-photo/route.ts',import.meta.url),'utf8');
  const js=stripTypeScriptTypes(source)
    .replace(/^import \{([^}]+)\} from "([^"]+)";/gm,(_,names,path)=>`const {${names}}=require(${JSON.stringify(path)});`)
    .replace(/export /g,'')+'\nexports.POST=POST; exports.DELETE=DELETE;';
  const exports={};
  new Function('require','exports',js)((name)=>{
    if(name.includes('supabase-server')) return {createServiceClient:()=>client};
    if(name==='next/server') return {NextResponse:Response};
    if(name.includes('event-photo')) return photoHelpers;
    throw new Error(`Unexpected dependency ${name}`);
  },exports);
  return exports;
}

test('Actual upload route stores all three formats at unique paths with public URLs', async()=>{
  const uploads=[];
  const client={storage:{
    getBucket:async()=>({data:{public:true},error:null}),
    from:(bucket)=>({
      upload:async(path,bytes,options)=>{uploads.push({bucket,path,bytes,options});return {error:null};},
      getPublicUrl:(path)=>({data:{publicUrl:`https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`}}),
    }),
  }};
  const route=routeWith(client);
  const fixtures=[['jpg','image/jpeg',[255,216,255]],['png','image/png',[137,80,78,71,13,10,26,10]],['webp','image/webp',new TextEncoder().encode('RIFF1234WEBP')]];
  for(const [extension,type,bytes] of fixtures){
    for(const suppliedType of [type,'application/octet-stream']){
      const form=new FormData();
      form.set('photo',new File([Uint8Array.from(bytes)],`fête.${extension}`,{type:suppliedType}));
      const response=await route.POST(new Request('http://localhost/api/visitor-event-photo',{method:'POST',body:form}));
      assert.equal(response.status,200);
      const result=await response.json();
      assert.match(result.path,new RegExp(`^visitor-submissions/[0-9a-f-]{36}\\.${extension}$`));
      assert.equal(result.imageUrl,`https://example.supabase.co/storage/v1/object/public/visitor-event-photos/${result.path}`);
      assert.equal(uploads.at(-1).options.contentType,type);
      assert.equal(uploads.at(-1).options.upsert,false);
    }
  }
  assert.equal(new Set(uploads.map(x=>x.path)).size,6);
});

test('Actual route rejects invalid content before writing to storage and reports missing configuration',async()=>{
  const route=routeWith({storage:{getBucket:()=>{throw new Error('Storage must not be called');}}});
  const form=new FormData();form.set('photo',new File(['not an image'],'photo.jpg',{type:'image/jpeg'}));
  const response=await route.POST(new Request('http://localhost/api/visitor-event-photo',{method:'POST',body:form}));
  assert.equal(response.status,400);
  assert.equal((await routeWith(null).POST(new Request('http://localhost'))).status,503);
});
