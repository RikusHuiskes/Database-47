import test from 'node:test';
import assert from 'node:assert/strict';
import {publicEventUrl,publicEventText,visitorEventData} from './public-event-links.ts';
test('visitor actions cannot open datasets, including a dataset in a website field',()=>{
 for(const url of ['https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda.csv#FMA123','https://example.fr/export.CSV?download=1','https://example.fr/data.json','javascript:alert(1)'])assert.equal(publicEventUrl(url),null);
 assert.equal(publicEventUrl('https://lenourrissat.com/'), 'https://lenourrissat.com/');
 assert.equal(publicEventUrl('https://example.fr/evenement/concert'), 'https://example.fr/evenement/concert');
});
test('the public response omits provenance without modifying administrator records',()=>{
 const source={events:[{id:'event-1',title:'Concert',source_url:'https://example.fr/data.csv',website_url:'https://example.fr/data.csv',booking_url:'https://example.fr/reserver',description:'Concert le soir.'}]};
 const shown=visitorEventData(source);
 assert.equal(shown.events[0].source_url,undefined);assert.equal(shown.events[0].website_url,null);assert.equal(shown.events[0].booking_url,'https://example.fr/reserver');
 assert.equal(source.events[0].source_url,'https://example.fr/data.csv');assert.equal(source.events[0].website_url,'https://example.fr/data.csv');
});
test('import metadata is removed in every presentation language, preserving the description',()=>{
 for(const text of ['Concert in Duras.\n\nBron: SIRTAQUI — CRT Nouvelle-Aquitaine. Bron bijgewerkt: 01/01/2026.','Concert in Duras. Source: SIRTAQUI — CRT Nouvelle-Aquitaine.','Concert in Duras. Source : SIRTAQUI — CRT Nouvelle-Aquitaine.'])assert.equal(publicEventText(text),'Concert in Duras.');
 assert.equal(publicEventText('Source of inspiration: the river.'),'Source of inspiration: the river.');
 assert.equal(publicEventText('Website '),'Website ');
});
