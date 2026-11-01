import {cpSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),target=path.join(root,'native-api','public');
mkdirSync(target,{recursive:true});
for(const name of ['municipal-photos','cote-de-duras-ios-icon.png','cote-de-duras-logo.webp','cote-de-duras-icon.png','streek-duras.jpg','ios-preview.webmanifest']){const source=path.join(root,'public',name);if(!existsSync(source))throw Error('Missing public asset: '+name);cpSync(source,path.join(target,name),{recursive:true});}
console.log('Public visitor assets prepared; no admin routes or server credentials included.');
