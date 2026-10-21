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

## Database migrations

Apply SQL migrations to the intended Supabase project before deploying app code
that calls their RPCs. `202610220001_admin_maintenance_and_category_names.sql`
restores the admin-only expired-event cleanup RPC and adds safe category-label
editing while keeping stable category slugs intact.
