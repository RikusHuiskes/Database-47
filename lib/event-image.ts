import reviewed from './data/reviewed-event-image-replacements.json' with {type:'json'};
export const EVENT_LOGO_URL='https://www.cotededuras.com/cote-de-duras-logo.webp';

/** Only exact, reviewed source images are replaced; new uploads remain untouched. */
export const REVIEWED_UNUSABLE_IMAGES:ReadonlySet<string>=new Set<string>(reviewed.map(image=>image.url));
export function eventDisplayImage(value?:string|null):string{
 const source=value?.trim()??'';
 if(!/^https?:\/\//i.test(source)||REVIEWED_UNUSABLE_IMAGES.has(source))return EVENT_LOGO_URL;
 return source;
}
