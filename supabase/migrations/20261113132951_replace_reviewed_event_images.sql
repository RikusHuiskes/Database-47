-- Exact URLs reviewed for low resolution or confirmed missing at their source.
-- Keep a server-only rollback record before replacing existing event photographs.
create table public.event_image_repair_history (
 event_id uuid primary key, original_url text, replacement_url text not null,
 repaired_at timestamptz not null default now()
);
alter table public.event_image_repair_history enable row level security;
revoke all on public.event_image_repair_history from public,anon,authenticated;
grant select on public.event_image_repair_history to service_role;

create or replace function public.normalize_reviewed_event_image()
returns trigger language plpgsql set search_path='' as $$
begin
 if not coalesce(new.is_directory_entry,false) and new.municipal_key is null
    and new.image_url=any(array[
  'https://aquitaine.media.tourinsoft.eu/upload/08AFF3FB-2D09-4ADC-81C9-2EFA575617C2/result-Capture-d-ecran-2026-11-06-122130.png',
  'https://aquitaine.media.tourinsoft.eu/upload/1147BF42-C90C-40D5-A52A-608E86282FC9/Capture-d-ecran-2026-11-10-115146.png',
  'https://aquitaine.media.tourinsoft.eu/upload/19E2FE0A-C5AC-4E50-9D5A-DCD9F8A988DE/handball-21.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/2F9E45B0-B527-4D2B-B530-63E1DFB2353E/result-file-00000000b9dc81f4ae88d55c90602566.png',
  'https://aquitaine.media.tourinsoft.eu/upload/38B93EFF-EC18-43F6-A287-0B6A74AAE0FC/pexels-kpaukshtite-712876.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/3B1B9ABC-FD43-4DBD-BFAE-0E8685090A50/2811-atelier.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/60BF3D1D-A9B1-471D-B9AD-F71793484691/result-Capture-d-ecran-2026-11-06-085550.png',
  'https://aquitaine.media.tourinsoft.eu/upload/7A078DEA-F8E2-4DF6-BA87-7211519831A5/result-Carsac-de-Gurson.png',
  'https://aquitaine.media.tourinsoft.eu/upload/81AF5297-7420-4ECE-AC5B-7B6145107C06/result-Voyage-sonore-Bergerac-28-novembre-2026.png',
  'https://aquitaine.media.tourinsoft.eu/upload/82B5F751-E97B-4726-BE74-F03F220B9610/Capture-d-ecran-2026-10-19-164532-fotor-20261019164720.png',
  'https://aquitaine.media.tourinsoft.eu/upload/85D0903D-5434-46BF-9DB5-E8BD3DBA45C5/result-Capture-d-ecran-2026-11-06-124300.png',
  'https://aquitaine.media.tourinsoft.eu/upload/BAE1222A-C972-4B18-96B8-008BDAB02415/Biodanza.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/C584EACC-9748-4730-8AFC-5BFFB05DB62A/MICRO-FOLIE-.pdf.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/CCE91156-BB27-4F36-A737-A83E9D22680A/result-Capture-d-ecran-2026-11-06-130855.png',
  'https://aquitaine.media.tourinsoft.eu/upload/D4FB0FA0-7749-4717-9A5D-B38BCF794CAF/result-Concert-21-NOVEMBRE-Png-reseaux.png',
  'https://aquitaine.media.tourinsoft.eu/upload/D74CD9A0-7434-4B34-ACD2-3E4B1088112F/a3-marche-3.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/E37E8F3F-6DB3-4486-907B-4EF37D6D5116/Univitis-Facade-exterieure-vin-bordeaux.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/F998948B-514C-40CB-A75B-7A7116F9129C/Capture-d-ecran-2026-10-19-162558-fotor-20261019162725.png',
  'https://aquitaine.media.tourinsoft.eu/upload/FD697CAB-A307-4BCE-909A-3F17F2DF5292/truffes.jpeg',
  'https://tourismeduras.com//images/gmapfp/GA8367/thumbs/capture-d-ecran-2026-10-07-104702.png',
  'https://tourismeduras.com//images/gmapfp/GA8371/thumbs/fleurs-2026.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8604/thumbs/rando-sept-a-dec-2026.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8635/thumbs/chateau-theobon-2018--1-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8659/thumbs/berticot-duras-2017--5-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8685/thumbs/2811-29112026-marche-de-noel-la-sauvetat.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8693/thumbs/2018-la-sauvetat-repas-des-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8698/thumbs/chants-noel-monteton.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8710/thumbs/2018-la-sauvetat-repas-des-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8798/thumbs/16-cuisine-cooking-christmas-noel-biscuit-vanille-vanilla-noisette-nut-1014x610.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8810/thumbs/16-cuisine-cooking-christmas-noel-biscuit-vanille-vanilla-noisette-nut-1014x610.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8899/thumbs/jeux-de-societe-1.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8958/thumbs/domaine-amblard-pauvert-st-sernin-4.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8978/thumbs/yoga-du-rire-duras-automne-2026-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA8981/thumbs/magret-de-canard-au-brasero-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA8982/thumbs/saint-astier-2.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9018/thumbs/marche-noel-loubes.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9024/thumbs/soiree-choucroute-2.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9042/thumbs/vide-ta-chambre-15-nov-levignac.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9043/thumbs/rassemblements-des-peres-noel-motards.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9051/thumbs/afficheatelierlaurent.png',
  'https://tourismeduras.com//images/gmapfp/GA9053/thumbs/expo-petit-vers-du-dropt.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9053/thumbs/theatre-salle-echo-28-nov-bas.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9055/thumbs/affiche-feerique-du-marche-de-noel-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA9059/thumbs/soiree-primeurs-cabri-berticot-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA9060/thumbs/marche-noel-levignac-de-guyenne-bas.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9061/thumbs/moustier-portes-ouvertes-bernardo-agrumes.png',
  'https://tourismeduras.com//images/gmapfp/GA9063/thumbs/reveillon-anamorphose-villeneuve-duras.jpg',
  'https://tourismeduras.com/media/com_gmapfp/buttons/images/cible.png',
  'https://www.mairie-marmande.fr/app/uploads/1/2026/10/DJI_0021-scaled-337x145.jpg'
 ]::text[]) then
  new.image_url='https://www.cotededuras.com/cote-de-duras-logo.webp';
 end if;
 return new;
end;
$$;
revoke all on function public.normalize_reviewed_event_image() from public,anon,authenticated;
create trigger normalize_reviewed_event_image before insert or update of image_url on public.events
for each row execute function public.normalize_reviewed_event_image();

insert into public.event_image_repair_history(event_id,original_url,replacement_url)
select id,image_url,'https://www.cotededuras.com/cote-de-duras-logo.webp' from public.events
where not coalesce(is_directory_entry,false) and municipal_key is null
 and (image_url is null or btrim(image_url)='' or image_url=any(array[
  'https://aquitaine.media.tourinsoft.eu/upload/08AFF3FB-2D09-4ADC-81C9-2EFA575617C2/result-Capture-d-ecran-2026-11-06-122130.png',
  'https://aquitaine.media.tourinsoft.eu/upload/1147BF42-C90C-40D5-A52A-608E86282FC9/Capture-d-ecran-2026-11-10-115146.png',
  'https://aquitaine.media.tourinsoft.eu/upload/19E2FE0A-C5AC-4E50-9D5A-DCD9F8A988DE/handball-21.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/2F9E45B0-B527-4D2B-B530-63E1DFB2353E/result-file-00000000b9dc81f4ae88d55c90602566.png',
  'https://aquitaine.media.tourinsoft.eu/upload/38B93EFF-EC18-43F6-A287-0B6A74AAE0FC/pexels-kpaukshtite-712876.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/3B1B9ABC-FD43-4DBD-BFAE-0E8685090A50/2811-atelier.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/60BF3D1D-A9B1-471D-B9AD-F71793484691/result-Capture-d-ecran-2026-11-06-085550.png',
  'https://aquitaine.media.tourinsoft.eu/upload/7A078DEA-F8E2-4DF6-BA87-7211519831A5/result-Carsac-de-Gurson.png',
  'https://aquitaine.media.tourinsoft.eu/upload/81AF5297-7420-4ECE-AC5B-7B6145107C06/result-Voyage-sonore-Bergerac-28-novembre-2026.png',
  'https://aquitaine.media.tourinsoft.eu/upload/82B5F751-E97B-4726-BE74-F03F220B9610/Capture-d-ecran-2026-10-19-164532-fotor-20261019164720.png',
  'https://aquitaine.media.tourinsoft.eu/upload/85D0903D-5434-46BF-9DB5-E8BD3DBA45C5/result-Capture-d-ecran-2026-11-06-124300.png',
  'https://aquitaine.media.tourinsoft.eu/upload/BAE1222A-C972-4B18-96B8-008BDAB02415/Biodanza.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/C584EACC-9748-4730-8AFC-5BFFB05DB62A/MICRO-FOLIE-.pdf.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/CCE91156-BB27-4F36-A737-A83E9D22680A/result-Capture-d-ecran-2026-11-06-130855.png',
  'https://aquitaine.media.tourinsoft.eu/upload/D4FB0FA0-7749-4717-9A5D-B38BCF794CAF/result-Concert-21-NOVEMBRE-Png-reseaux.png',
  'https://aquitaine.media.tourinsoft.eu/upload/D74CD9A0-7434-4B34-ACD2-3E4B1088112F/a3-marche-3.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/E37E8F3F-6DB3-4486-907B-4EF37D6D5116/Univitis-Facade-exterieure-vin-bordeaux.jpg',
  'https://aquitaine.media.tourinsoft.eu/upload/F998948B-514C-40CB-A75B-7A7116F9129C/Capture-d-ecran-2026-10-19-162558-fotor-20261019162725.png',
  'https://aquitaine.media.tourinsoft.eu/upload/FD697CAB-A307-4BCE-909A-3F17F2DF5292/truffes.jpeg',
  'https://tourismeduras.com//images/gmapfp/GA8367/thumbs/capture-d-ecran-2026-10-07-104702.png',
  'https://tourismeduras.com//images/gmapfp/GA8371/thumbs/fleurs-2026.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8604/thumbs/rando-sept-a-dec-2026.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8635/thumbs/chateau-theobon-2018--1-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8659/thumbs/berticot-duras-2017--5-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8685/thumbs/2811-29112026-marche-de-noel-la-sauvetat.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8693/thumbs/2018-la-sauvetat-repas-des-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8698/thumbs/chants-noel-monteton.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8710/thumbs/2018-la-sauvetat-repas-des-.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8798/thumbs/16-cuisine-cooking-christmas-noel-biscuit-vanille-vanilla-noisette-nut-1014x610.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8810/thumbs/16-cuisine-cooking-christmas-noel-biscuit-vanille-vanilla-noisette-nut-1014x610.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8899/thumbs/jeux-de-societe-1.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8958/thumbs/domaine-amblard-pauvert-st-sernin-4.jpg',
  'https://tourismeduras.com//images/gmapfp/GA8978/thumbs/yoga-du-rire-duras-automne-2026-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA8981/thumbs/magret-de-canard-au-brasero-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA8982/thumbs/saint-astier-2.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9018/thumbs/marche-noel-loubes.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9024/thumbs/soiree-choucroute-2.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9042/thumbs/vide-ta-chambre-15-nov-levignac.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9043/thumbs/rassemblements-des-peres-noel-motards.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9051/thumbs/afficheatelierlaurent.png',
  'https://tourismeduras.com//images/gmapfp/GA9053/thumbs/expo-petit-vers-du-dropt.basjpg.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9053/thumbs/theatre-salle-echo-28-nov-bas.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9055/thumbs/affiche-feerique-du-marche-de-noel-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA9059/thumbs/soiree-primeurs-cabri-berticot-bas.png',
  'https://tourismeduras.com//images/gmapfp/GA9060/thumbs/marche-noel-levignac-de-guyenne-bas.jpg',
  'https://tourismeduras.com//images/gmapfp/GA9061/thumbs/moustier-portes-ouvertes-bernardo-agrumes.png',
  'https://tourismeduras.com//images/gmapfp/GA9063/thumbs/reveillon-anamorphose-villeneuve-duras.jpg',
  'https://tourismeduras.com/media/com_gmapfp/buttons/images/cible.png',
  'https://www.mairie-marmande.fr/app/uploads/1/2026/10/DJI_0021-scaled-337x145.jpg'
 ]::text[]));
update public.events e set image_url=h.replacement_url,updated_at=now()
from public.event_image_repair_history h where e.id=h.event_id and e.image_url is not distinct from h.original_url;
