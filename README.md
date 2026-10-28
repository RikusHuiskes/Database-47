# DATABASE 47

### Permanent listings and category search (28 October 2026)

Admin management searches the complete loaded collection by name, linked
category (including uncategorized), and pending/all status together. Name search
ignores accents and punctuation. Results have counts, reset controls and 25-row
pages; filter changes restart at page one. Pagination clamps safely after
approvals or deletions. Run `node --test lib/admin-event-search.test.mjs`.

The categories Hotels & Chambres d’hôtes & Gîtes, Wijnhuizen and Cafés use
SIRTAQUI’s published hotel, guesthouse, holiday rental, vineyard, nightlife and
restaurant CSV feeds. Cafés are selected from source names/types, rather than
from a restaurant merely mentioning a bar service. Source attribution and update
dates remain in descriptions. Public map feeds are an optional supplement; errors
are recorded in the source report and do not masquerade as empty coverage.

`node scripts/refresh-directory.mjs` refreshes `lib/data/directory-entries.json`.
`POST /api/import-directory` imports fixed 100-record snapshot batches after a
normal admin session check. The database import RPC is service-role-only and
deduplicates source identities, URLs and matching directory names/towns. Existing
records and admin edits are preserved. Imported listings remain pending review.
The admin includes a repeat-import button; only new listings are added.

Apply `20261028153003_directory_entries.sql` before deploying this release.
Permanent listings have `is_directory_entry=true` and null start/end dates.
Ordinary events still require a start date. The existing expired-event cleanup
therefore leaves permanent listings intact. Listings use the same approve,
edit, photo, category and admin-delete flows as events. The existing category
link cascade is retained. The admin-delete policy migration restores the missing
authenticated-admin DELETE permission without allowing ordinary users to delete.

Public search validates category UUIDs and intersects `event_categories`
membership with date/approval and distance filters. The browser also checks the
returned category-link array. Promotions use the same filtered result set.
Selecting all categories keeps unlinked eligible events visible.

The Test import added 4,815 pending listings: 4,016 accommodations, 571 wineries
and 228 cafés. 4,512 have source photos. All 53 guide towns have all three types
within their configured search radius; this does not mean every town has a local
business in each category. `scripts/directory-coverage-query.mjs` produces the
database audit query, which distinguishes exact town/postcode counts from radius
counts. No businesses are assigned to a nearby town to fill gaps.

Regression checks: `node --test lib/nearby-events.test.mjs lib/directory.test.mjs
lib/admin-delete.test.mjs lib/analytics.test.mjs lib/analytics-sql.test.mjs
lib/event-photo.test.mjs lib/additive-import.test.mjs lib/tourisme-duras.test.mjs
lib/regional-official-agendas.test.mjs`, followed by `next build`.

### Audience analytics

Apply `supabase/migrations/202610280001_analytics.sql` to the intended Supabase
environment before deploying the analytics release. It creates a new RLS-enabled
`site_analytics` table, a service-role-only recording RPC, an admin-only report
RPC and a service-role-only retention RPC. It does not change event rows,
categories, authentication accounts or existing storage policies. Daily cleanup
calls the retention RPC along with the existing expired-event cleanup.

The admin dashboard reports measured browser visitors, 30-minute sessions,
category and town interest, event opens, visible placements and outbound clicks,
with period selection and CSV export. Consent is required before a visitor or
session identifier is created. No IP address, email, search text or full URL is
included in the analytics records. Codes/consent expire after 180 days; records
are pruned after 13 months. Reporting starts at activation and is indicative,
not a complete person count or proof of bookings. Browser administrators and
known bot user agents are excluded. Impressions require 50% visibility for one
second and are deduplicated per session/event/placement. Identified sessions
are rate-limited, but public client-side analytics is not fraud-proof.

The report also shows agenda pageviews, monthly unique browser/session totals,
and combinations of town, category and 10/25/50 km filters, including the initial
selection. GPS coordinates and free-text searches are never recorded. The agenda
is a single-page application; event detail openings have their own metric.

Run `node --test lib/analytics.test.mjs lib/analytics-sql.test.mjs` for consent,
collector validation and PostgreSQL integration tests. SQL tests use an isolated
in-memory PGlite instance; they never connect to Supabase.

### Supermarkets, fuel and EV charging

The municipal guide includes supermarkets, fuel stations and EV charging
locations, both individually and under all categories. A sourced OpenStreetMap
snapshot in `lib/data/municipal-mobility.json` keeps these searches available
without waiting for an external map server. Refresh it with
`node scripts/refresh-municipal-mobility.mjs`. Private, inaccessible, disused
and explicitly bicycle-only charging sites are excluded. Customer-only access
is labelled. Map links use exact coordinates where available. Charging details
are source information rather than live availability or a tariff guarantee.
Run `node --test lib/municipal-mobility.test.mjs` to verify classification and
coverage of all three categories across all 53 guide towns.

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
unverified events. Existing text, dates, photos, status and category links are
preserved. After `202610270001_source_photo_supplements.sql`, repeated imports
can also fill a missing photo from the same source URL. Imports run in batches
of at most 100 with a transaction lock. Duras
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

Manual event creation and editing share `lib/event-photo.ts` for file type
recognition. JPG/PNG/WebP files with missing or generic picker MIME types are
accepted by extension, then checked against their byte signature on the server.
Storage always receives the normalized MIME type and a fresh UUID path, so a
replacement cannot overwrite an existing or imported image. Run `pnpm test:photo`
to check the validation and the actual multipart upload route with mocked storage.
The public `visitor-event-photos` bucket permits these three MIME types and 5 MB;
writes use the server service key, so no anonymous Storage write policy is needed.

Apply `202610270002_manual_event_identity.sql` to allow manual events to share
a title and organizer URL. The server generates a unique slug for each manual
submission. The previous form payload is also recognized, including already-open
deployments. Imported source URLs stay unique; existing rows and photos are not
rewritten. `supabase/tests/manual_event_identity.sql` checks legacy and current
payloads, photo retention and import deduplication inside a rollback transaction.

The SIRTAQUI `PHOTOS` field contains media identifiers and filenames, rather
than complete URLs. `sirtaquiPhotoUrl` resolves these against the source's media
host and retains the identifier. The refresh script and live importer use the
same parser. `prepare-source-photo-repair.mjs` prepares photo-only additions for
previous imports; the admin/server RPC never replaces an existing photo.

Use the existing feature branch for test deployments. Its Preview environment
contains the Test Supabase URL, public key and server key. A deployment from a
different branch does not inherit branch-specific keys. The stable test URL is
https://database-47-git-feature-tourisme-duras-enrichment-rikushuiskes.vercel.app/ .
