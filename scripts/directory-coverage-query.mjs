import {readFileSync} from 'node:fs';
const {areas}=JSON.parse(readFileSync(new URL('../lib/data/area-catalog.json',import.meta.url),'utf8'));
const json=JSON.stringify(areas).replaceAll("'","''");
console.log(`with towns as(select * from jsonb_to_recordset('${json}'::jsonb) a(name text,postcode text,latitude double precision,longitude double precision,radius_km double precision)),
entries as(select e.*,c.slug as category_slug from public.events e join public.event_categories ec on ec.event_id=e.id join public.categories c on c.id=ec.category_id where e.is_directory_entry)
select t.name as municipality,c.slug as category,t.radius_km,
count(e.id) filter(where regexp_replace(translate(lower(e.city),'àâäçéèêëîïôöùûüÿ','aaaceeeeiioouuuy'),'[^a-z0-9]','','g')=regexp_replace(translate(lower(case when t.name='Beaumont-du-Périgord' then 'Beaumontois en Périgord' else t.name end),'àâäçéèêëîïôöùûüÿ','aaaceeeeiioouuuy'),'[^a-z0-9]','','g') and e.postcode=t.postcode) as in_municipality,
count(e.id) filter(where e.latitude is not null and e.longitude is not null and
6371*2*asin(least(1,sqrt(power(sin(radians(e.latitude-t.latitude)/2),2)+cos(radians(t.latitude))*cos(radians(e.latitude))*power(sin(radians(e.longitude-t.longitude)/2),2)))) <= t.radius_km) as within_radius
from towns t cross join (select slug from public.categories where slug in ('hotels-chambres-hotes-gites','wijnhuizen','cafes')) c
left join entries e on e.category_slug=c.slug group by t.name,c.slug,t.radius_km order by t.name,c.slug;`);
