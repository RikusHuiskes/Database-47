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
connecting its persistence RPC. New rows must remain pending review, preserve the
source URL for deduplication, and skip events without a mapped category. Sources
that require login or do not permit automated access need an authorized feed or
manual export instead of scraping.

Potential local sources to evaluate next (not connected yet):
`marie-marmande.fr`, `marie.monsegur.eu`, `eymet-dordogne.fr`, `pineuilh.fr`,
`www.saintefoylagrande.fr`, `bergerac.fr`, and `pays-bergerac-tourisme.com`.
Before connecting each one, confirm how its agenda is published and what reuse or
automated access it permits. Visitor-submitted events require an information
source and stay pending until a manager checks them.

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
