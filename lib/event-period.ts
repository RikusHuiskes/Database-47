export type QuickPeriod = 'today' | 'week' | 'weekend';
/** Inclusive calendar days in France. Week = Monday–Sunday; weekend = Saturday–Sunday. */
export function quickPeriodRange(period: QuickPeriod, now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
  const date = new Date(day + 'T12:00:00Z');
  const weekday = date.getUTCDay() || 7;
  const shift = (offset:number) => {const value = new Date(date); value.setUTCDate(value.getUTCDate()+offset); return value.toISOString().slice(0,10);};
  if(period === 'today') return {start:day,end:day};
  if(period === 'week') return {start:shift(1-weekday),end:shift(7-weekday)};
  return {start:shift(6-weekday),end:shift(7-weekday)};
}
export const CHRISTMAS_CATEGORY = {id:'a9f07cb5-4db8-4ea0-b893-cb25bd714a64',slug:'kerstmarkten',name:'Marchés de Noël'};
/** Conservative preview classification: a Christmas market in the title, not every Christmas event. */
export function isChristmasMarket(event:{title?:string|null}) {
  const raw=event.title??'';
  const title=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(?:courses?|randonnee|nordique|pedestre)\b/.test(title)&&!/(?:^|\s)marchés?(?=\s)/i.test(raw))return false;
  return /marche(?:s)?\b.{0,60}\bnoel|christmas\s+market|kerstmarkt|weihnachtsmarkt/.test(title);
}
