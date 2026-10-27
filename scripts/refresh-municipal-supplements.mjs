import {readFile,writeFile} from 'node:fs/promises';
import {parseSirtaquiCsv} from '../lib/sirtaqui.ts';
import {distanceInKm} from '../lib/local-area.ts';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const points=[];
const fetchBytes=async(url)=>{const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`${response.status}: ${url}`);return new Uint8Array(await response.arrayBuffer());};
const librariesUrl='https://static.data.gouv.fr/resources/adresses-des-bibliotheques-publiques-2/20250827-130731/adresses-des-bibliotheques-publiques.geojson';
const libraries=JSON.parse(new TextDecoder().decode(await fetchBytes(librariesUrl)));
for(const [index,feature] of (libraries.features??[]).entries()){
 const row=feature.properties,coordinates=feature.geometry?.coordinates ?? [Number(feature.properties.longitude),Number(feature.properties.latitude)];
 if(!Array.isArray(coordinates))continue;
 const [longitude,latitude]=coordinates;
 if(!areas.some(area=>distanceInKm(area.latitude,area.longitude,latitude,longitude)<=area.radius_km))continue;
 points.push({id:`culture-library-${row.code_bib??row.identifiant??row.id??index}`,type:'library',name:row.nom_de_l_etablissement||row.libelle_2||'Bibliothèque',municipality:row.ville,latitude,longitude,
  address:[row.adresse,row.cp,row.ville].filter(Boolean).join(', '),phone:row.telephone||undefined,website:row.site_internet||undefined,
  sourceUrl:librariesUrl,sourceName:'Ministère de la Culture — bibliothèques publiques (données 2025)'});
}
const tourismUrl='https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-points-infos-tourisme.csv';
const offices=parseSirtaquiCsv(new TextDecoder('windows-1252').decode(await fetchBytes(tourismUrl)));
for(const row of offices){const latitude=Number(row.LATITUDE),longitude=Number(row.LONGITUDE);
 if(!row.LATITUDE||!row.LONGITUDE||!areas.some(area=>distanceInKm(area.latitude,area.longitude,latitude,longitude)<=area.radius_km))continue;
 points.push({id:`sirtaqui-${row['IDENTIFIANT SIRTAQUI']}`,type:'tourism',name:row.NOM_OFFRE,municipality:row.COMMUNE,latitude,longitude,
  address:[row.BATIMENT_RESIDENCE,row.RUE,row.LIEUDIT_BP,row.CODE_POSTAL,row.COMMUNE].filter(Boolean).join(', '),phone:row.TEL||undefined,email:row.MEL||undefined,website:row.SITE_WEB?.split(' # ')[0]||undefined,
  extra:row.DESCRIPTIF||undefined,sourceUrl:tourismUrl+'#'+row['IDENTIFIANT SIRTAQUI'],sourceName:'SIRTAQUI — offices de tourisme',sourceUpdatedAt:row.DATE_DERNIERE_MAJ});
}
await writeFile(new URL('../lib/data/municipal-supplements.json',import.meta.url),JSON.stringify({updatedAt:new Date().toISOString(),points}));
console.log(JSON.stringify({libraries:points.filter(point=>point.type==='library').length,tourism:points.filter(point=>point.type==='tourism').length,sample:points.slice(0,2)}));
