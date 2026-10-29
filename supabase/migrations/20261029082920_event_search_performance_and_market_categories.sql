begin;
create index if not exists event_categories_category_event_idx on public.event_categories(category_id, event_id);
create index if not exists events_start_id_idx on public.events(start_at, id);

-- Correct only the broad secondary food theme on SIRTAQUI markets.
-- Preserve every event, photo, approval, promotion and other category.
delete from public.event_categories food
using public.events e, public.categories c
where food.event_id=e.id and food.category_id=c.id
  and c.slug='restaurants-gastronomie'
  and e.is_manual_entry is not true
  and e.source_url like 'https://aquitaine.media.tourinsoft.eu/upload/SIRTAQUI-OD-liste-csv-agenda-%'
  and exists (
    select 1 from public.event_categories market
    join public.categories m on m.id=market.category_id
    where market.event_id=e.id and m.slug='marches-brocantes'
  );
commit;
