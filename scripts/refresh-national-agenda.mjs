import {readFile,writeFile} from 'node:fs/promises';
import {fetchOpenAgendaEvents} from '../lib/openagenda.ts';
const {areas}=JSON.parse(await readFile(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const data=await fetchOpenAgendaEvents(areas);
await writeFile(new URL('../lib/data/openagenda-events.json',import.meta.url),JSON.stringify(data));
console.log(JSON.stringify({recordsChecked:data.recordsChecked,events:data.events.length}));
