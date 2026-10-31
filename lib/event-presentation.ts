type PresentedEvent = {
  id: string;
  start_at: string;
  is_directory_entry?: boolean;
  promotion_type?: string | null;
  promotion_status?: string | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  category_ids?: string[];
  reserved_homepage?: boolean;
  reserved_category_id?: string | null;
};

export function promotionIsActive(event:Pick<PresentedEvent,'promotion_status'|'promotion_start_at'|'promotion_end_at'>,now=new Date()){
  if(event.promotion_status!=='active')return false;
  const starts=event.promotion_start_at?Date.parse(event.promotion_start_at):Number.NEGATIVE_INFINITY;
  const ends=event.promotion_end_at?Date.parse(event.promotion_end_at):Number.POSITIVE_INFINITY;
  return starts<=now.getTime()&&now.getTime()<ends;
}

export function upcomingHighlights<T extends PresentedEvent>(events: T[], now = new Date()) {
  return events.filter(event => !event.is_directory_entry && Number.isFinite(Date.parse(event.start_at))
      && Date.parse(event.start_at) >= now.getTime()
      && !(event.promotion_type === 'homepage' && promotionIsActive(event, now)))
    .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at) || left.id.localeCompare(right.id))
    .slice(0, 3);
}

export function promotionPlacements<T extends PresentedEvent>(events: T[], category: string) {
  const eligible = events.filter(event => category === 'all' || event.category_ids?.includes(category));
  const home = events.find(event=>event.reserved_homepage);
  const categorySlot = category==='all'?undefined:events.find(event=>event.reserved_category_id===category);
  const order = (paid:T[],reserved:T|undefined) => [...(reserved?[reserved]:[]),...uniqueEventRecords(paid).filter(event=>!reserved||event.id!==reserved.id).slice(0,reserved?8:9)];
  return {
    homepage: order(eligible.filter(event => event.promotion_type === 'homepage' && promotionIsActive(event)),home),
    category: category === 'all' ? [] : order(eligible.filter(event => event.promotion_type === 'category' && promotionIsActive(event)),categorySlot),
  };
}

/** Preserve separate occurrences/manual submissions, but never repeat a record. */
export function uniqueEventRecords<T extends {id: string}>(events: T[]) {
  return [...new Map(events.map(event => [event.id, event])).values()];
}
