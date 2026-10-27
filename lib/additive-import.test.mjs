import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSirtaquiCsv,sirtaquiLocalTimestamp,sirtaquiCategories} from './sirtaqui.ts';
import {parseOpenAgendaEvents} from './openagenda.ts';
import {serviceFetch} from './supabase-server.ts';

test('CSV retains multiline descriptions, escaped quotes and semicolons',()=>{
 assert.deepEqual(parseSirtaquiCsv('ID;TEXT\r\n"42";"one; two\n""quoted"""\r\n'),[{ID:'42',TEXT:'one; two\n"quoted"'}]);
 assert.throws(()=>parseSirtaquiCsv('ID;TEXT\n42;"broken'));
});
test('French calendar dates stay on their source day across winter and summer time',()=>{
 assert.equal(sirtaquiLocalTimestamp('01/11/2026','00:00'),'2026-11-01T00:00:00+01:00');
 assert.equal(sirtaquiLocalTimestamp('03/10/2026','10:00'),'2026-10-03T10:00:00+02:00');
 assert.equal(sirtaquiLocalTimestamp('31/02/2027','10:00'),null);
 assert.equal(sirtaquiLocalTimestamp('28/03/2027','02:30'),null);
});
test('Published combined categories are kept without assigning unrelated categories',()=>{
 const categories=sirtaquiCategories({NOM_OFFRE:'Marché des producteurs',CATEGORIE:'Marché',TYPE:'Manifestation commerciale',THEME:'Gastronomie'});
 assert.deepEqual(categories,['marches-brocantes','restaurants-gastronomie']);
 assert(!categories.includes('concerts-musique'));
});
test('National recurring events use actual sessions, skip past sessions and preserve source times',()=>{
 const row={uid:'42',canonicalurl:'https://openagenda.com/test/events/show',title_fr:'Concert',keywords_fr:['Musique'],location_coordinates:{lat:44.6764,lon:0.1837},location_city:'Duras',timings:JSON.stringify([{begin:'2026-10-01T20:00:00+02:00',end:'2026-10-01T22:00:00+02:00'},{begin:'2026-11-01T20:00:00+01:00',end:'2026-11-03T22:00:00+01:00'}])};
 const events=parseOpenAgendaEvents([row,row],[{latitude:44.6764,longitude:0.1837,radius_km:25}],new Date('2026-10-27T10:00:00Z'));
 assert.equal(events.length,1);assert.equal(events[0].start_at,'2026-11-01T19:00:00.000Z');assert.equal(events[0].end_at,'2026-11-03T21:00:00.000Z');assert.equal(events[0].status,'pending');assert.equal(events[0].verified,false);
});
test('Storage sends new secret keys only as API keys and retains real JWT authorization',async()=>{
 const seen=[];const mock=async(input,init)=>{seen.push(new Headers(init.headers));return new Response('{}');};
 const fetcher=serviceFetch('sb_secret_TEST_ONLY','https://example.supabase.co',mock);
 await fetcher('https://example.supabase.co/storage/v1/bucket',{headers:{apikey:'sb_secret_TEST_ONLY',authorization:'Bearer sb_secret_TEST_ONLY'}});
 assert.equal(seen[0].get('authorization'),null);assert.equal(seen[0].get('apikey'),'sb_secret_TEST_ONLY');
 await fetcher('https://example.supabase.co/rest/v1/events',{headers:{apikey:'sb_secret_TEST_ONLY',authorization:'Bearer real.session.jwt'}});
 assert.equal(seen[1].get('authorization'),'Bearer real.session.jwt');
});
