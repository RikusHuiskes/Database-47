import type { SupabaseClient } from '@supabase/supabase-js';

/** Only called for admins. Load four pages at a time, preserving stable order
 * and stopping on errors rather than showing a silently incomplete collection. */
export async function loadAdminEvents(client: SupabaseClient) {
  const size = 500;
  const page = (offset: number, count = false) => client.from('events')
    .select('*,event_categories(category_id)', count ? {count: 'exact'} : {})
    .order('start_at', {ascending: true}).order('id').range(offset, offset + size - 1);
  const first = await page(0, true);
  if (first.error) return first;
  const rows = [...(first.data ?? [])];
  if (first.count == null) {
    for (let offset = size; rows.length === offset; offset += size) {
      const result = await page(offset);
      if (result.error) return result;
      rows.push(...(result.data ?? []));
    }
  } else {
    for (let offset = size; offset < first.count; offset += 4 * size) {
      const offsets = Array.from({length: Math.min(4, Math.ceil((first.count - offset) / size))}, (_, index) => offset + index * size);
      const results = await Promise.all(offsets.map(value => page(value)));
      const failed = results.find(result => result.error);
      if (failed) return failed;
      for (const result of results) rows.push(...(result.data ?? []));
    }
  }
  return {...first, data: rows};
}
