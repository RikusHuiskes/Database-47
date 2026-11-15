# Christmas campaign — approval preview

Branch: feature/christmas-campaign-preview. Do not merge or promote before owner approval.

- `/campagnes/kerstmarkten`: responsive FR/NL/EN landing page using approved, verified, upcoming events within 50 km of Duras.
- Same date shortcuts in the full agenda and campaign. France calendar days; Monday–Sunday for week and Saturday–Sunday for weekend.
- Carousel rotates every six seconds, pauses on focus/hover, hides rotation in background tabs, honours reduced motion, and offers previous/next/pause controls.
- Detail dialog uses native modal focus handling and Escape. Website and booking actions use existing sanitised public links.
- Preview-only category overlay `kerstmarkten` classifies market titles without writing to the shared production database. Actual events/photos only; no invented dates.
- No new category is persisted yet. The overlay is for searching and reviewing; do not assign it to production records via the preview admin. After approval, create a migration using the Supabase CLI, insert the category and add reviewed event/category links while preserving their existing categories. Remove the preview overlay after verifying persisted membership. Add importer classification for new Christmas markets as part of release.
- The campaign is noindex during review. Remove that restriction only on approved release.
- Public campaign URL and canonical/OG URLs must use production origin only after approval.

## Category SQL to review (not run)

```sql
begin;
insert into public.categories(id,name,slug,sort_order,active)
values ('a9f07cb5-4db8-4ea0-b893-cb25bd714a64','Marchés de Noël','kerstmarkten',35,true)
on conflict (slug) do nothing;
-- Add explicit, reviewed event IDs using INSERT ... SELECT and ON CONFLICT DO NOTHING.
-- Preserve all existing event_categories memberships. Do not bulk-delete or reclassify events.
commit;
```

## Validation

Run `node --experimental-strip-types --test lib/event-period.test.mjs`, `npx tsc --noEmit` and `npm run build`.
Review 390px and 768px widths; empty results, failed data load, all periods, category link, share, dialog and carousel controls.
