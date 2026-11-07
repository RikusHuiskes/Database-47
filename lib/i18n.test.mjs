import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import test from 'node:test';import assert from 'node:assert/strict';
const source=stripTypeScriptTypes(readFileSync(new URL('./i18n.ts',import.meta.url),'utf8'));
const {createTranslator,localeFrom,messageKey,localizeOpeningHours,localizeMunicipalName,startsNewLanguageVisit}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const reviewed=JSON.parse(readFileSync(new URL('../app/i18n/messages/reviewed.json',import.meta.url),'utf8'));
const dictionaries={en:Object.fromEntries(reviewed.map(row=>[row[0],row[1]])),fr:Object.fromEntries(reviewed.map(row=>[row[0],row[2]]))};
test('French is the default; explicit Dutch and English choices are preserved',()=>{assert.equal(localeFrom('fr'),'fr');assert.equal(localeFrom('en'),'en');assert.equal(localeFrom('nl'),'nl');for(const value of ['de',undefined,null,''])assert.equal(localeFrom(value),'fr');});

test('Direct openings, QR links and external deep links restart in French even with an old language cookie',()=>{
 for(const language of ['nl','en','fr'])for(const path of ['/','/de-streek-beleven','/mijn-vermelding?onderdeel=betalingen']){
  const headers={accept:'text/html',cookie:`cdd-language=${language}`,'sec-fetch-dest':'document','sec-fetch-site':'none'};
  assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com'+path,{headers})),true);
  headers['sec-fetch-site']='cross-site';headers.referer='https://search.example/';
  assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com'+path,{headers})),true);
 }
 assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com/',{headers:{accept:'text/html',cookie:'cdd-language=nl'}})),true);
});

test('Internal links, language refreshes, assets and form submissions retain their current language',()=>{
 const headers={accept:'text/html',cookie:'cdd-language=en','sec-fetch-dest':'document','sec-fetch-site':'same-origin',referer:'https://www.cotededuras.com/handleiding'};
 assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com/mijn-vermelding',{headers})),false);
 for(const destination of ['empty','image','script'])assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com/handleiding',{headers:{...headers,'sec-fetch-dest':destination,'sec-fetch-site':'none'}})),false);
 assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com/',{method:'POST',headers})),false);
 assert.equal(startsNewLanguageVisit(new Request('https://www.cotededuras.com/handleiding',{headers:{accept:'text/html',referer:'https://www.cotededuras.com/'}})),false);
});

test('The page response resets only language before server rendering and preserves unrelated cookies',async()=>{
 const nextServer=new URL('../node_modules/next/server.js',import.meta.url).href;
 const i18nModule='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const proxySource=stripTypeScriptTypes(readFileSync(new URL('../proxy.ts',import.meta.url),'utf8')).replace("'next/server'",JSON.stringify(nextServer)).replace("'./lib/i18n'",JSON.stringify(i18nModule));
 const {proxy}=await import('data:text/javascript;base64,'+Buffer.from(proxySource).toString('base64'));
 const {NextRequest}=await import(nextServer);
 const response=proxy(new NextRequest('https://www.cotededuras.com/de-streek-beleven',{headers:{accept:'text/html','sec-fetch-dest':'document','sec-fetch-site':'none',cookie:'test-session=retain-this; cdd-language=nl; statistics=declined'}}));
 assert.equal(response.cookies.get('cdd-language')?.value,'fr');
 assert.match(response.headers.get('set-cookie'),/SameSite=lax/i);
 assert.doesNotMatch(response.headers.get('set-cookie'),/Max-Age|Expires/i);
 const forwarded=response.headers.get('x-middleware-request-cookie');
 assert.match(forwarded,/cdd-language=fr/);assert.match(forwarded,/test-session=retain-this/);assert.match(forwarded,/statistics=declined/);
 assert.doesNotMatch(forwarded,/cdd-language=nl/);
 const internal=proxy(new NextRequest('https://www.cotededuras.com/handleiding',{headers:{accept:'text/html','sec-fetch-dest':'document','sec-fetch-site':'same-origin',referer:'https://www.cotededuras.com/',cookie:'cdd-language=en'}}));
 assert.equal(internal.headers.get('set-cookie'),null);
});
test('language changes preserve source names, links and data',()=>{for(const locale of ['nl','en','fr']){const t=createTranslator(locale,dictionaries[locale]??{});for(const text of ['Le Nourrissat','1049 Route de Nourrissat','47120 Savignac-de-Duras','https://example.org/mijn-vermelding#private-token'])assert.equal(t(text),text);}});
test('all three advertising options have reviewed translations',()=>{for(const locale of ['en','fr']){const t=createTranslator(locale,dictionaries[locale]);for(const source of ['Vetomrande vermelding','Categorieadvertentie','Homepageadvertentie'])assert.notEqual(t(source),source);}});
test('dynamic sentences preserve names and counts literally',()=>{const t=createTranslator('en',{'Je bewerkt nu: {0}':'You are editing: {0}','Er zijn {0} resultaten in {1}.':'There are {0} results in {1}.'});assert.equal(t('Je bewerkt nu: Côte de Duras'),'You are editing: Côte de Duras');assert.equal(t('Er zijn 9 resultaten in Duras.'),'There are 9 results in Duras.');});
test('currency changes its presentation, never its value',()=>{assert.match(createTranslator('en',{})('€ 1.788,00'),/1,788\.00/);assert.match(createTranslator('fr',{})('€ 1.788,00'),/1\s788,00/);});
test('dates use the selected language',()=>{assert.equal(createTranslator('en',{})('25 december 2026'),'25 December 2026');assert.equal(createTranslator('fr',{})('25 december 2026'),'25 décembre 2026');});
test('public text keys are deterministic and whitespace-independent',()=>{assert.equal(messageKey('Hello\n world'),messageKey('Hello world'));assert.match(messageKey('Public description'),/^[a-f\d]{16}$/);assert.notEqual(messageKey('One'),messageKey('Two'));});
test('labels embedded in dynamic sentences are translated in their context',()=>{const t=createTranslator('fr',{'Apotheek':'Pharmacie','{0} voorzieningen in {1}':'{0} services à {1}','Duras':'Duras'});assert.equal(t('apotheek'),'pharmacie');assert.equal(t('3 voorzieningen in Duras'),'3 services à Duras');assert.equal(t('DURAS'),'DURAS');});
test('opening hours retain every time while day names change',()=>{const hours='Mo-Fr 08:00-12:30; Sa 09:00-13:00; PH off';assert.equal(localizeOpeningHours(hours,'en'),'Mon-Fri 08:00-12:30; Sat 09:00-13:00; public holidays closed');assert.equal(localizeOpeningHours(hours,'fr'),'lun.-ven. 08:00-12:30; sam. 09:00-13:00; jours fériés fermé');assert.equal(localizeOpeningHours(hours,'nl'),hours);assert.equal(localizeOpeningHours('1049 Route de Nourrissat','fr'),null);});

test('generated mobility labels change language while streets and real names stay intact',()=>{
 assert.equal(localizeMunicipalName('Invalide parkeerplaatsen · Parkeerterrein','en'),'Accessible parking spaces · Car park');
 assert.equal(localizeMunicipalName('Invalide parkeerplaats · Rue Victor Hugo','en'),'Accessible parking space · Rue Victor Hugo');
 assert.equal(localizeMunicipalName('Invalide parkeerplaatsen · Parking de la Mairie','fr'),'Places de stationnement réservées aux personnes handicapées · Parking de la Mairie');
 for(const locale of ['nl','en','fr'])for(const name of ['Parking de la Mairie','Le Nourrissat','Supermarkt Albert Heijn'])assert.equal(localizeMunicipalName(name,locale),name);
 assert.equal(localizeMunicipalName('Bushalte · Rue de la Gare','nl'),'Bushalte · Rue de la Gare');
});
test('mobility information translates for new counts without changing their values',()=>{
 const rows=JSON.parse(readFileSync(new URL('../app/i18n/messages/reviewed-mobility.json',import.meta.url),'utf8'));
 for(const [locale,index]of [['en',1],['fr',2]]){
  const t=createTranslator(locale,Object.fromEntries(rows.map(row=>[row[0],row[index]])));
  const source='Capaciteit volgens bron: 127 plaatsen. Gereserveerde invalide parkeerplaatsen volgens bron: 3. Gratis parkeren volgens bron.';
  const result=source.split(/(?<=\.)\s+(?=[A-ZÀ-ÖØ-Þ])/u).map(t).join(' ');
  assert.match(result,/127/);assert.match(result,/3/);assert.doesNotMatch(result,/volgens bron|Invalide|Gereserveerde/);
 }
});

test('Dutch navigation also translates French category labels',()=>{const nl=JSON.parse(readFileSync(new URL('../app/i18n/messages/nl.json',import.meta.url),'utf8'));const t=createTranslator('nl',nl);assert.equal(t('Concerts & Musique'),'Concerten & muziek');assert.equal(t('Marchés & Brocantes'),'Markten & brocante');assert.equal(t('Duras'),'Duras');});
