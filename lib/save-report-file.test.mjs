import test from 'node:test';
import assert from 'node:assert/strict';
import {saveReportFile} from './save-report-file.ts';
test('Saving selects the destination before fetching, writes the CSV bytes, and closes only after writing',async()=>{
 const calls=[];let saved;
 const picker=async options=>{calls.push('picker');assert.equal(options.suggestedName,'cote-de-duras-bereik-30-dagen.csv');assert.deepEqual(options.types[0].accept,{'text/csv':['.csv']});return {async createWritable(){calls.push('create');return {async write(data){calls.push('write');saved=await data.text();},async close(){calls.push('close');}};}};};
 const pending=saveReportFile(picker,'csv',30,async()=>{calls.push('fetch');return new Blob(['naam;bezoekers\r\nDuras;5'],{type:'text/csv'});});
 assert.deepEqual(calls,['picker']);
 assert.equal(await pending,'cote-de-duras-bereik-30-dagen.csv');
 assert.deepEqual(calls,['picker','fetch','create','write','close']);assert.equal(saved,'naam;bezoekers\r\nDuras;5');
});
test('Unsupported browsers, cancelled dialogs and failed requests never start a navigation or write',async()=>{
 let loaded=false,written=false;
 const load=async()=>{loaded=true;return new Blob(['csv']);};
 await assert.rejects(saveReportFile(undefined,'csv',30,load),/Chrome of Edge/);assert.equal(loaded,false);
 await assert.rejects(saveReportFile(async()=>{throw new DOMException('Cancelled','AbortError');},'csv',30,load),{name:'AbortError'});assert.equal(loaded,false);
 await assert.rejects(saveReportFile(async()=>({async createWritable(){written=true;}}),'csv',30,async()=>{throw Error('Niet ingelogd');}),/Niet ingelogd/);assert.equal(written,false);
});
test('A failed write aborts the file rather than reporting success',async()=>{
 let aborted=false,closed=false;
 await assert.rejects(saveReportFile(async()=>({async createWritable(){return {async write(){throw Error('Disk full');},async close(){closed=true;},async abort(){aborted=true;}};}}),'xlsx',7,async()=>new Blob(['xlsx'])),/Disk full/);
 assert(aborted);assert.equal(closed,false);
});
