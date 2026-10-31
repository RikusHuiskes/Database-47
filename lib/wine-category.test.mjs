import test from 'node:test';
import assert from 'node:assert/strict';
import {isWineTasting} from './wine-category.ts';
test('Regional appellations and vintage tastings are wine; chocolate and cooking classes stay gastronomy',()=>{
  assert(isWineTasting({title:'Beaujolais nouveau',description:'Soirée accompagnée de planches à partager.'}));
  for(const event of [{title:'Visite & dégustation | Château les Farcies du Pech',description:'Rencontrez-nous au château pour une dégustation et achetez sur place votre Pécharmant.'},{title:'Portes ouvertes | Château du Rooy',description:'Une dégustation de vieux millésimes accompagnés de fouées.'},{title:'Wine tasting',description:'Our wine estate welcomes you.'}])assert(isWineTasting(event));
  for(const event of [{title:'Dégustation de chocolat',description:'Chocolats et pralines artisanales.'},{title:'Ateliers de cuisine et dîner à la table du vigneron',description:'17h30 : Visite-dégustation animée par le vigneron. 18h30 atelier de cuisine et dîner.'},{title:'Repas gastronomique',description:'Menu du terroir.'}])assert(!isWineTasting(event));
});
