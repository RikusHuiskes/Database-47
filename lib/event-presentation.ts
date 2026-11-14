type PresentedEvent = {
  id: string;
  start_at: string;
  is_directory_entry?: boolean;
  advertising_placements?: {placement:string;starts_at:string;ends_at:string}[] | null;
  promotion_type?: string | null;
  promotion_status?: string | null;
  promotion_start_at?: string | null;
  promotion_end_at?: string | null;
  category_ids?: string[];
  reserved_homepage?: boolean;
  reserved_category_id?: string | null;
};

/** Seeded layout samples are not real calendar events or paid advertisements. */
export function isDemoLayoutAdvertisement(event: { slug?: string | null }) {
 return typeof event.slug === 'string' && event.slug.startsWith('demo-layout-20261030-');
}

export function promotionIsActive(event:Pick<PresentedEvent,'promotion_status'|'promotion_start_at'|'promotion_end_at'>,now=new Date()){
  if(event.promotion_status!=='active')return false;
  const starts=event.promotion_start_at?Date.parse(event.promotion_start_at):Number.NEGATIVE_INFINITY;
  const ends=event.promotion_end_at?Date.parse(event.promotion_end_at):Number.POSITIVE_INFINITY;
  return starts<=now.getTime()&&now.getTime()<ends;
}

/** Each paid placement has its own lifetime; one purchase cannot replace another. */
export function hasAdvertisingPlacement(event:PresentedEvent,placement:string,now=new Date()){
 if(event.promotion_status==='ended')return false;
 if(event.advertising_placements!=null)return event.advertising_placements.some(ad=>ad.placement===placement&&Date.parse(ad.starts_at)<=now.getTime()&&now.getTime()<Date.parse(ad.ends_at));
 return event.promotion_type===placement&&promotionIsActive(event,now);
}

/** Existing active advertisers do not need the public acquisition button. */
export function hasActiveAdvertising(event:PresentedEvent,now=new Date()){
 return Boolean(event.reserved_homepage||event.reserved_category_id||['highlight','category','homepage'].some(kind=>hasAdvertisingPlacement(event,kind,now)));
}

export function upcomingHighlights<T extends PresentedEvent>(events: T[], now = new Date()) {
  return events.filter(event => !event.is_directory_entry && Number.isFinite(Date.parse(event.start_at))
      && Date.parse(event.start_at) >= now.getTime()
      )
    .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at) || left.id.localeCompare(right.id))
    .slice(0, 3);
}

export function promotionPlacements<T extends PresentedEvent>(events: T[], category: string) {
  const eligible = events.filter(event => category === 'all' || event.category_ids?.includes(category));
  const home = events.find(event=>event.reserved_homepage);
  const categorySlot = category==='all'?undefined:events.find(event=>event.reserved_category_id===category);
  const order = (paid:T[],reserved:T|undefined) => [...(reserved?[reserved]:[]),...uniqueEventRecords(paid).filter(event=>!reserved||event.id!==reserved.id).slice(0,reserved?8:9)];
  return {
    homepage: order(eligible.filter(event => hasAdvertisingPlacement(event,'homepage')),home),
    category: category === 'all' ? [] : order(eligible.filter(event => hasAdvertisingPlacement(event,'category')),categorySlot),
  };
}

/** Preserve separate occurrences/manual submissions, but never repeat a record. */
export function uniqueEventRecords<T extends {id: string}>(events: T[]) {
  return [...new Map(events.map(event => [event.id, event])).values()];
}

/** Stable partition: paid, currently active bold listings precede ordinary ones. */
export function prioritizeHighlighted<T extends PresentedEvent>(events:T[],now=new Date()){
 return [...events].sort((left,right)=>Number(hasAdvertisingPlacement(right,'highlight',now))-Number(hasAdvertisingPlacement(left,'highlight',now)));
}
