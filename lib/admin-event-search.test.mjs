import test from 'node:test';
import assert from 'node:assert/strict';
import {searchAdminEvents} from './admin-event-search.ts';

test('Admin name, category links and pending status are combined; accents and punctuation are tolerated',()=>{
 const events=[
  {title:'Château de l’Été',status:'pending',category_ids:['wine','hotel']},
  {title:'Château de l’Été concert',status:'pending',category_ids:['music']},
  {title:'Château déjà validé',status:'approved',category_ids:['hotel']},
  {title:'Café de la Place',status:'pending',category_ids:[]}
 ];
 assert.deepEqual(searchAdminEvents(events,"chateau l'ete",'hotel','pending',1).items,[events[0]]);
 assert.equal(searchAdminEvents(events,'chateau','hotel','all',1).total,2);
 assert.deepEqual(searchAdminEvents(events,'cafe','none','all',1).items,[events[3]]);
 assert.equal(searchAdminEvents(events,'chateau','music','pending',1).total,1);
});

test('Search scans the complete import collection before pagination, and clamps pages after deletion or narrower filtering',()=>{
 const events=Array.from({length:5010},(_,i)=>({title:i>=5000?`Gîte cible ${i}`:`Other ${i}`,status:'pending',category_ids:['hotel']}));
 const result=searchAdminEvents(events,'gite cible','hotel','pending',900,3);
 assert.equal(result.total,10);assert.equal(result.page,4);assert.equal(result.pages,4);assert.equal(result.items[0].title,'Gîte cible 5009');
 const first=searchAdminEvents(events,'','all','all',1);
 assert.equal(first.items.length,25);assert.equal(first.from,1);assert.equal(first.to,25);
 const empty=searchAdminEvents(events,'absent','all','all',9);
 assert.equal(empty.total,0);assert.equal(empty.page,1);assert.deepEqual(empty.items,[]);assert.equal(empty.from,0);
});
