begin;

-- These rows were seeded only to demonstrate ad layouts. Keep the records for
-- auditability, but stop them from occupying visitor-facing ad placements.
update public.events
set promotion_status = 'ended', updated_at = now()
where slug like 'demo-layout-20261030-%'
  and title like 'VOORBEELD %'
  and promotion_status = 'active';

commit;
