import test from 'node:test';
import assert from 'node:assert/strict';
import {isPendingImport,approvePendingImports} from './admin-bulk-approve.ts';

const imported=(id)=>({id:String(id),title:`Import ${id}`,status:'pending',is_manual_entry:false,source_url:`https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-hotels.csv#${id}`,category_ids:['hotel'],image_url:'https://example.com/photo.jpg'});
function mockClient(rows,{failAt=0,changeBeforeSecond=false}={}){
 const calls=[];
 return {calls,from(table){
  assert.equal(table,'events');
  let payload,ids;const filters={};
  const query={update(value){payload=value;return this;},in(key,value){assert.equal(key,'id');ids=value;return this;},eq(key,value){filters[key]=value;return this;},async select(columns){
   assert.equal(columns,'id');assert.deepEqual(payload,{status:'approved',verified:true});assert.deepEqual(filters,{status:'pending',is_manual_entry:false});assert.ok(ids.length<=100);
   calls.push(ids);
   if(failAt===calls.length)return {data:null,error:{message:'Network failure'}};
   if(changeBeforeSecond&&calls.length===2)rows.find(row=>row.id===ids[0]).status='rejected';
   const matched=rows.filter(row=>ids.includes(row.id)&&row.status==='pending'&&row.is_manual_entry===false);
   matched.forEach(row=>Object.assign(row,payload));return {data:matched.map(row=>({id:row.id})),error:null};
  }};return query;
 }};
}

test('Only pending imports with a known source qualify; manual, rejected and unrelated submissions do not',()=>{
 const good=imported(1);assert.equal(isPendingImport(good),true);
 for(const change of [{is_manual_entry:true},{status:'approved'},{status:'rejected'},{source_url:null},{source_url:'invalid'},{source_url:'https://unrelated.example/page'},{source_url:'https://tourismeduras.com.evil.example/page'}])assert.equal(isPendingImport({...good,...change}),false);
});

test('Approves the entire snapshot in batches, preserves record details, and skips concurrent status changes',async()=>{
 const rows=[...Array.from({length:250},(_,i)=>imported(i)),{...imported('manual'),is_manual_entry:true},{...imported('rejected'),status:'rejected'}];
 const client=mockClient(rows,{changeBeforeSecond:true}),progress=[];
 const result=await approvePendingImports(client,structuredClone(rows),p=>progress.push(p));
 assert.deepEqual(result,{approved:249,skipped:1});assert.equal(client.calls.length,3);assert.equal(progress.at(-1).processed,250);
 assert.equal(rows[100].status,'rejected');assert.equal(rows[250].status,'pending');assert.equal(rows[251].status,'rejected');
 assert.deepEqual(rows[0].category_ids,['hotel']);assert.equal(rows[0].image_url,'https://example.com/photo.jpg');assert.equal(rows[0].verified,true);
});

test('Failure stops later batches; rerunning only processes remaining pending imports',async()=>{
 const rows=Array.from({length:250},(_,i)=>imported(i));let approved=0;
 const client=mockClient(rows,{failAt:2});
 await assert.rejects(approvePendingImports(client,structuredClone(rows),p=>{approved=p.approved;}),/Network failure/);
 assert.equal(approved,100);assert.equal(client.calls.length,2);
 const retry=await approvePendingImports(mockClient(rows),rows,()=>{});
 assert.deepEqual(retry,{approved:150,skipped:0});
});
