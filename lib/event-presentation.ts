type PresentedEvent = {
  id: string;
  start_at: string;
  is_directory_entry?: boolean;
  promotion_type?: string | null;
  promotion_status?: string | null;
  category_ids?: string[];
};

export function upcomingHighlights<T extends PresentedEvent>(events: T[]) {
  return events.filter(event => !event.is_directory_entry && Number.isFinite(Date.parse(event.start_at))
      && !(event.promotion_type === 'homepage' && event.promotion_status === 'active'))
    .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at) || left.id.localeCompare(right.id))
    .slice(0, 3);
}

export function promotionPlacements<T extends PresentedEvent>(events: T[], category: string) {
  const eligible = events.filter(event => category === 'all' || event.category_ids?.includes(category));
  return {
    homepage: eligible.filter(event => event.promotion_type === 'homepage' && event.promotion_status === 'active').slice(0, 3),
    category: category === 'all' ? [] : eligible.filter(event => event.promotion_type === 'category' && event.promotion_status === 'active'),
  };
}

/** Preserve separate occurrences/manual submissions, but never repeat a record. */
export function uniqueEventRecords<T extends {id: string}>(events: T[]) {
  return [...new Map(events.map(event => [event.id, event])).values()];
}
