# DATABASE 47

Central events platform for Lot-et-Garonne (47).

## Stack

- Next.js
- Supabase
- Vercel

## Components

- Admin dashboard
- Events
- Organisations
- Locations
- Categories
- Promotions
- Payments
- iOS app
- Android app

## External event sources

Importers produce the shared `ImportedEvent` shape and use the `ExternalEventSource`
contract in `lib/import-sources.ts`. The Duras adapter in
`lib/import-sources/tourisme-duras.ts` supplies source fetching and category mapping;
the cron route supplies the source-specific Supabase persistence function. A new
structured source can reuse `runExternalEventImport` by adding an adapter and
connecting its persistence RPC. New rows remain pending review and preserve the
source URL for deduplication. Events without a confident category match are also
imported without a category so an administrator can assign one manually. Sources
that require login or do not permit automated access need an authorized feed or
manual export instead of scraping.

### Source discovery around Duras

The visitor radius is a display filter. The importer can collect a broader
catalogue, while every new source event is stored as `pending` / `verified=false`
and linked to its source URL. The administrator can correct its category before
approval.

| Priority | Source | What it offers | Import decision |
| --- | --- | --- | --- |
| Existing | [Tourisme Duras](https://www.tourismeduras.com/s-eclater-rencontrer/agenda-des-sorties) | Detailed local listing and individual event pages | Daily importer already exists. |
| Paused | [DATAtourisme API](https://www.datatourisme.fr/utiliser-les-donnees/) | National open-data API and event-only endpoint; aggregates institutional tourism databases | Do not import its dates until DATAtourisme confirms its reported one-day date shift is resolved. |
| 2 | [Eymet cultural agenda](https://www.pays-bergerac-tourisme.com/fr/agenda/calendrier-des-animations/programmation-espace-culturel-leden-eymet), published by [Eymet’s L’Eden cultural service](https://www.eymet-dordogne.fr/fr/rb/304280/lespace-culturel) | Current L’Eden program with individual event pages, dates, venue, practical details, ticket links and event images | Eymet adapter is connected. Each event keeps its Pays de Bergerac detail-page URL as its source and remains pending review. Apply the Eymet import migration before enabling the daily job. |
| Daily | [Ville de Marmande events](https://www.mairie-marmande.fr/evenements/) | Municipal listings with individual event pages, dates, venues and images | Connected to the regional daily importer. New items go to Wacht op controle with the original detail-page URL. |
| Daily | [Miramont-de-Guyenne agenda](https://www.ville-miramontdeguyenne.fr/fr/) | Official city calendar with dated event pages | Connected to the regional daily importer. |
| Daily | [Pineuilh events](https://www.pineuilh.fr/manifestations-pineuilh-gironde) | Official municipality calendar with dated event pages and posters | Connected to the regional daily importer. Dates from the event listing are preferred when the article contains dates for several activities. |
| Daily | [Sainte-Foy-la-Grande events](https://www.saintefoylagrande.fr/tous-les-evenements/) | Official municipal calendar and detail pages | Connected to the regional daily importer. |
| 5 | [Pays de Bergerac Tourisme agenda](https://www.pays-bergerac-tourisme.com/index.php/fr/agenda/calendrier-des-animations) and [Vallée du Lot-et-Garonne agenda](https://tourisme.valleedulotetgaronne.com/agenda/) | Regional tourism calendars with broad coverage, categories, event details and booking links | Useful coverage, but likely overlaps the API and town calendars; connect after source IDs and deduplication are checked. |
| 6 | [Mairie de Monségur](https://www.mairie.monsegur.eu/) | Official site has an Agenda heading and Facebook link | Agenda appears limited/embedded; request a calendar feed or authorized export if automated access is unclear. |

Facebook groups and general Instagram searches are not included: the importer
does not sign in as a person or collect login-gated posts. Add social sources
only when Meta provides an authorized feed/API for the specific account or
group, or when an administrator supplies an export. Public official calendars
remain the automatic, original-source route.

### Daily maintenance

Vercel schedules Duras at 07:00 UTC, Eymet at 08:00 UTC, regional municipal
agendas at 09:00 UTC, and expired-event cleanup at 10:00 UTC. The separated
hours keep the tasks in order on Hobby, where Vercel may start each daily task
anywhere within its scheduled hour. Vercel cron jobs run only from a Production
deployment; Preview is for manual testing.
Cleanup uses the French date and prefers `end_at` over `start_at`; it removes
past imported and manually entered events in every status. The new cleanup job
requires `delete_expired_events_cron` and the server-only
`SUPABASE_SERVICE_ROLE_KEY` Vercel variable. Apply the migration to the intended
Supabase environment before enabling this job there.
The regional agenda cron also uses `SUPABASE_SERVICE_ROLE_KEY`; its RPC is
granted only to the Supabase service role. Apply
`202610230001_regional_official_agenda_import.sql` before deployment. Its response
includes per-city page and import counts so an unreachable official agenda is
visible in the cron run result.

## Nearby events experience

The public home page lets visitors search around Duras, Monteton, Eymet,
Monségur, Marmande, Pineuilh, Sainte-Foy-la-Grande, or their current location.
Visitors choose a 10, 25, or 50 km radius. This radius only filters the public
results; it never limits what importers can store in the shared event database.
The nearby-events API returns only verified, approved events whose end date (or
start date when there is no end date) has not passed. When an event has no saved
coordinates, the API uses the French government's commune center service where
the place can be identified. Distances based on a commune center are marked as
approximate. An event with no identifiable location is left out of radius
results until its location is completed.

## Database migrations

Apply SQL migrations to the intended Supabase project before deploying app code
that calls their RPCs. `202610220001_admin_maintenance_and_category_names.sql`
restores the admin-only expired-event cleanup RPC and adds safe category-label
editing while keeping stable category slugs intact.
`202610220002_scheduled_expired_event_cleanup.sql` adds the server-only daily
cleanup RPC. `202610220004_eymet_pending_import.sql` enables the daily Eymet
import and only inserts or enriches pending, unverified events. The Eymet importer
uses the current L’Eden agenda published by Pays de Bergerac Tourisme; its event
detail URL is saved as the source link. The linked municipal cultural page is at
`eymet-dordogne.fr`. Items that no longer have a future or ongoing date are skipped.

## Additive imports and complete area coverage (27 October 2026)

The new `import_pending_source_events(jsonb)` RPC only inserts new, pending,
unverified events. It never updates existing event fields, status or category
links. Imports run in batches of at most 100 with a transaction lock. Duras
numeric source IDs survive title/URL changes; exact source URLs and matching
title/date/commune records prevent repeated and cross-source submissions.
Apply `202610260001_additive_source_import.sql` to Test before deploying this code.
The RPC is available only to administrators and the server service role.

The admin keeps the existing Duras and Eymet buttons and adds separate previews
for SIRTAQUI Dordogne, Gironde and Lot-et-Garonne; the four municipal calendars;
and the national OpenAgenda dataset. Every import goes to Wacht op controle.
The admin reads all event/category pages, rather than hiding records after 100.
SIRTAQUI and OpenAgenda daily jobs run at 06:00 and 05:00 UTC respectively.
Preview deployments can be tested manually; Vercel only schedules Production.

SIRTAQUI's original open CSV feeds are used directly, not the paused DATAtourisme
API. French source dates and Windows-1252 accents are preserved. OpenAgenda uses
each published session, not an artificial continuous range. Events with several
relevant published types keep multiple category links. New source snapshots and
the 53 place coordinates are under `lib/data/`, with origins and update dates.
Default search radii are 25 km, and 10 km for Bergerac and Agen.

Municipal information adds downloaded OSM, DILA, Ministry of Culture library,
SIRTAQUI tourist-office and national elected-official records to the existing
curated entries. Existing curated details are retained. Source names and links
remain attached to concrete records. Missing opening times or phone numbers are
not invented. OSM data is attributed to its contributors under ODbL; DILA,
Ministry of Culture and elected-official data are under the French Open Licence;
SIRTAQUI is credited to CRT Nouvelle-Aquitaine with source update dates.

Refresh/recheck commands:

```
node scripts/refresh-area-data.mjs
node scripts/refresh-national-agenda.mjs
node scripts/refresh-municipal-supplements.mjs
node scripts/refresh-mayors.mjs
node scripts/audit-coverage.mjs
node scripts/audit-municipal-coverage.mjs
pnpm test:import
pnpm build
```

Raw download caches and audit intermediates stay in ignored `work/`. Delete a
cached source file there to force a fresh download on the next refresh. No
credentials belong in these data files. The photo uploader now sends new
`sb_secret_` keys only in the API-key header, while retaining legacy/session JWT
authorization. Images above 3.5 MB are resized before upload to fit Vercel's
request limit; the existing user-facing 5 MB input limit is retained.
