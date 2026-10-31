import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../lib/data/municipal-shops.json',import.meta.url);
const snapshot=JSON.parse(await readFile(path,'utf8'));
const polygons=[];
function inRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function contains(x,y,rings){return inRing(x,y,rings[0])&&!rings.slice(1).some(r=>inRing(x,y,r));}
for(const department of ['24','33','47','32']){
 const cache=new URL(`../work/shops/communes-${department}.json`,import.meta.url);let data;
 try{data=JSON.parse(await readFile(cache,'utf8'));}catch{const response=await fetch(`https://geo.api.gouv.fr/departements/${department}/communes?fields=nom,code,codesPostaux&format=geojson&geometry=contour`,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('Communegrenzen '+response.status);data=await response.json();await writeFile(cache,JSON.stringify(data));}
 for(const f of data.features){
  const parts=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[];
  for(const rings of parts){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const [x,y]of rings[0]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}polygons.push({rings,properties:f.properties,minX,minY,maxX,maxY});}
 }
}
let located=0;
for(const point of snapshot.points){
 if(!point.id.startsWith('osm-')||point.latitude==null||point.longitude==null)continue;
 const x=point.longitude,y=point.latitude;
 const match=polygons.find(p=>x>=p.minX&&x<=p.maxX&&y>=p.minY&&y<=p.maxY&&contains(x,y,p.rings));
 if(match){point.codeInsee=match.properties.code;point.municipality=match.properties.nom;point.municipalitySourceUrl=`https://geo.api.gouv.fr/communes/${point.codeInsee}`;
  if(match.properties.codesPostaux?.length===1)point.postcode=match.properties.codesPostaux[0];
  if(point.address&&!point.address.toLowerCase().includes(point.municipality.toLowerCase()))point.address=[point.address,point.postcode,point.municipality].filter(Boolean).join(' ');
  located++;
 }
}
const curated=[
 {match:'La Graphisteria',address:'25 place Robert Darniche, 33580 Monségur',municipality:'Monségur',codeInsee:'33289',phone:'+33 6 71 63 89 41',email:'studio@la-graphisteria.fr',website:'https://la-graphisteria.fr/',sourceUrl:'https://la-graphisteria.fr/contact/',sourceName:'La Graphisteria — contactgegevens van de winkel'},
 {match:'Arts Terre',address:"24 rue Neuve d’Argenson, 24100 Bergerac",municipality:'Bergerac',codeInsee:'24037',sourceUrl:'https://www.pays-bergerac-tourisme.com/sites/site.fr/files/upload/Actus/bulletin%20de%20participation%202.pdf',sourceName:'Pays de Bergerac Tourisme — winkeladres'},
];
for(const addition of curated){const point=snapshot.points.find(p=>p.name.toLowerCase()===addition.match.toLowerCase());if(point){const {match,...fields}=addition;Object.assign(point,fields);}}
await writeFile(path,JSON.stringify(snapshot));
console.log(JSON.stringify({municipalitiesResolved:located,total:snapshot.points.length,withAddress:snapshot.points.filter(p=>p.address).length,withMunicipality:snapshot.points.filter(p=>p.municipality).length}));
