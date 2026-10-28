import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../lib/data/directory-entries.json',import.meta.url),'utf8'));
const offset=Number(process.argv[2]??0);
if(!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid offset');
const json=JSON.stringify(data.entries.slice(offset,offset+100));
process.stdout.write("select public.import_directory_entries('"+json.replaceAll("'","''")+"'::jsonb) as report;");
