# Dedicated public visitor app service

Public test environment: https://cote-de-duras-app.vercel.app/ (Vercel project `cote-de-duras-app`, Node 24). The production alias here serves the visitor **test** environment; it does not declare App Store readiness. The original website project is separate. Deploy this project's `native-api` directory from `feature/tourisme-duras-enrichment`, not the repository's older `main` branch.

This project exposes only the visitor app, its help/privacy pages, public media and three read-only data routes. It has no admin, owner management, Mollie, mail sending, ingestion, or write endpoints. The original website and its deployment protection stay separate.

Configure only `NEXT_PUBLIC_SUPABASE_URL` and the existing project's enabled publishable/anon key. Do not configure a service-role/secret key here. Public category reads and approved/verified listing reads respect the existing RLS policies. Directory advertising decoration explicitly receives that public client.

The event center is fixed to Duras and the radius is at most 50 km. Directory parameters are resolved through the known Duras town/type catalogs, not arbitrary user locations. Public GET results use short CDN caching. Media are copied from the existing licensed/sourced public assets during build and retain source attribution.

Build from this directory with `node ../scripts/prepare-native-api.mjs && node ../node_modules/next/dist/bin/next build --webpack`. Install the parent repository's locked dependencies first. This project's initial mode is `test`; `/api/status` reports `releaseReady: false`. Changing a label is not evidence that production data or the Apple release is ready.
