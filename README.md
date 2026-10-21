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
| 1 | [DATAtourisme API](https://www.datatourisme.fr/utiliser-les-donnees/) | National open-data API and event-only endpoint; aggregates 40+ institutional tourism databases | Best next technical connector for a 50 km Duras search. Free API key required; keep creator attribution and update date under Licence Ouverte Etalab 2.0. Check duplicates against Tourisme Duras. |
| 2 | [Eymet cultural agenda](https://www.pays-bergerac-tourisme.com/fr/agenda/calendrier-des-animations/programmation-espace-culturel-leden-eymet), published by [Eymet’s L’Eden cultural service](https://www.eymet-dordogne.fr/fr/rb/304280/lespace-culturel) | Current L’Eden program with individual event pages, dates, venue, practical details, ticket links and event images | Eymet adapter is connected. Each event keeps its Pays de Bergerac detail-page URL as its source and remains pending review. Apply the Eymet import migration before enabling the daily job. |
| 3 | [Ville de Marmande events](https://www.mairie-marmande.fr/evenements/) | Official municipal calendar with event details and images | Strong direct source; confirm technical access and date/category handling before adapter. |
| 4 | [Pineuilh events](https://www.pineuilh.fr/manifestations-pineuilh-gironde) and [Sainte-Foy-la-Grande events](https://www.saintefoylagrande.fr/tous-les-evenements/) | Official nearby town agendas with event cards and seasonal programs | Evaluate as separate sources after the shared regional API. |
| 5 | [Pays de Bergerac Tourisme agenda](https://www.pays-bergerac-tourisme.com/index.php/fr/agenda/calendrier-des-animations) and [Vallée du Lot-et-Garonne agenda](https://tourisme.valleedulotetgaronne.com/agenda/) | Regional tourism calendars with broad coverage, categories, event details and booking links | Useful coverage, but likely overlaps the API and town calendars; connect after source IDs and deduplication are checked. |
| 6 | [Mairie de Monségur](https://www.mairie.monsegur.eu/) | Official site has an Agenda heading and Facebook link | Agenda appears limited/embedded; request a calendar feed or authorized export if automated access is unclear. |

Other names (`marie-marmande.fr`, `marie.monsegur.eu`, `bergerac.fr`,
`paysfoyen.fr`) should be checked against the confirmed official URLs above
before being added. Facebook groups remain manual/authorized submissions; do
not scrape private or login-gated content.

### Daily maintenance

Vercel runs the Duras source at 07:00, Eymet at 07:05 and expired-event cleanup at 07:15.
Cleanup uses the French date and prefers `end_at` over `start_at`; it removes
past imported and manually entered events in every status. The new cleanup job
requires `delete_expired_events_cron` and the server-only
`SUPABASE_SERVICE_ROLE_KEY` Vercel variable. Apply the migration to the intended
Supabase environment before enabling this job there.

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
