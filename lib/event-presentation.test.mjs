import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingHighlights,promotionPlacements,uniqueEventRecords} from './event-presentation.ts';
import {normalizeWebAddress} from './web-address.ts';
import {loadAdminEvents} from './admin-event-loader.ts';

test('Soon cards sort by date, ignore permanent listings, preserve distinct occurrences',()=>{
  const events=[{id:'late',start_at:'2027-01-04'},{id:'hotel',start_at:'',is_directory_entry:true},{id:'early',start_at:'2026-11-01'},{id:'second',start_at:'2026-11-02'},{id:'third',start_at:'2026-11-03'}];
  assert.deepEqual(upcomingHighlights(events,new Date("2026-10-31T12:00:00Z")).map(event=>event.id),['early','second','third']);
  assert.equal(events[0].id,'late');
  assert.deepEqual(upcomingHighlights([{id:'sponsor',start_at:'2026-10-01',promotion_type:'homepage',promotion_status:'active'},...events],new Date('2026-10-31T12:00:00Z')).map(event=>event.id),['early','second','third']);
  assert.deepEqual(uniqueEventRecords([events[0],events[0],events[2]]).map(event=>event.id),['late','early']);
});

test('Homepage and category advertisements require activation and obey selected category',()=>{
  const events=['active','requested','ended','none'].flatMap(status=>['homepage','category'].map(type=>({id:`${type}-${status}`,start_at:'2027-01-01',promotion_type:type,promotion_status:status,category_ids:['food']})));
  events.push({id:'other',start_at:'2027-01-01',promotion_type:'category',promotion_status:'active',category_ids:['music']});
  const food=promotionPlacements(events,'food');
  assert.deepEqual(food.homepage.map(event=>event.id),['homepage-active']);
  assert.deepEqual(food.category.map(event=>event.id),['category-active']);
  assert.deepEqual(promotionPlacements(events,'all').category,[]);
  assert.deepEqual(promotionPlacements(events,'music').homepage,[]);
});

test('Nine homepage and nine category ads are visible; highlighted results remain unlimited',()=>{
  const events=['homepage','category','highlight'].flatMap(type=>Array.from({length:12},(_,i)=>({id:`${type}-${i}`,start_at:'2099-01-01',promotion_type:type,promotion_status:'active',category_ids:['food']})));
  events.push(...Array.from({length:10},(_,i)=>({id:`music-${i}`,start_at:'2099-01-01',promotion_type:'category',promotion_status:'active',category_ids:['music']})));
  const food=promotionPlacements(events,'food');
  assert.equal(food.homepage.length,9);assert.equal(food.category.length,9);
  assert(food.category.every(event=>event.category_ids.includes('food')));
  assert.equal(promotionPlacements(events,'music').category.length,9);
  assert.equal(events.filter(event=>event.promotion_type==='highlight').length,12);
  assert.equal(events.filter(event=>!new Set(food.category.map(ad=>ad.id)).has(event.id)&&event.promotion_type==='highlight').length,12);
});

test('A reserved house placement is first in both rotations, with eight other ads and no duplicate',()=>{
 const hotel='hotel',house={id:'house',start_at:'',is_directory_entry:true,reserved_homepage:true,reserved_category_id:hotel,category_ids:[hotel],promotion_type:'homepage',promotion_status:'requested'};
 const paid=['homepage','category'].flatMap(type=>Array.from({length:12},(_,i)=>({id:`${type}-${i}`,start_at:'',promotion_type:type,promotion_status:'active',category_ids:[hotel]})));
 const slots=promotionPlacements([...paid,house,house],hotel);
 for(const group of [slots.homepage,slots.category]){assert.equal(group.length,9);assert.equal(group[0].id,'house');assert.equal(group.filter(event=>event.id==='house').length,1);}
 assert.equal(promotionPlacements([...paid,house],'other').category.length,0);
 assert.equal(promotionPlacements([house],'all').homepage[0].id,'house');
});

test('Web addresses accept www, domains, HTTPS and HTTP; reject empty prefixes and unsafe schemes',()=>{
  for(const [input,expected] of [['www.voorbeeld.fr','https://www.voorbeeld.fr/'],['voorbeeld.fr/reserveren','https://voorbeeld.fr/reserveren'],[' https://voorbeeld.fr/pad?q=1#info ','https://voorbeeld.fr/pad?q=1#info'],['http://voorbeeld.fr','http://voorbeeld.fr/']]) assert.equal(normalizeWebAddress(input),expected);
  for(const input of ['', 'https://','javascript:alert(1)','ftp://voorbeeld.fr','geen website','https://a:b@voorbeeld.fr'])assert.equal(normalizeWebAddress(input),null);
});

test('Admin loads 11,054 complete records with their categories in bounded parallel pages; errors fail the collection',async()=>{
  const rows=Array.from({length:11054},(_,i)=>({id:String(i),event_categories:[{category_id:'food'}]}));
  let active=0,maxActive=0,calls=0,fail=false;
  const client={from(table){assert.equal(table,'events');return {select(columns){assert(columns.includes('event_categories'));return this},order(){return this},async range(start,end){calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return {data:rows.slice(start,end+1),count:rows.length,error:fail&&start===500?{message:'offline'}:null};}}}};
  const result=await loadAdminEvents(client);
  assert.deepEqual(result.data,rows);assert.equal(calls,23);assert.equal(maxActive,4);
  fail=true;assert.equal((await loadAdminEvents(client)).error.message,'offline');
});

test('Soon cards skip old ongoing events and invalid dates, with deterministic chronological ties',()=>{
 const now=new Date('2026-10-31T12:00:00Z');
 const events=[{id:'old',start_at:'2026-10-01'},{id:'bad',start_at:'bad'},{id:'b',start_at:'2026-11-01T10:00:00Z'},{id:'later',start_at:'2026-12-01'},{id:'a',start_at:'2026-11-01T10:00:00Z'}];
 assert.deepEqual(upcomingHighlights(events,now).map(e=>e.id),['a','b','later']);
});
