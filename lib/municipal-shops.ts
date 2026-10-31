export const SHOP_LABELS = {bakery:'Bakkerij',butcher:'Slagerij',tobacco:'Tabak / Kiosk',souvenirs:'Souvenirswinkel',shoes:'Schoenenwinkel',florist:'Bloemist',fashion:'Mode',diy:'Bouwmarkten',jeweller:'Juwelier',hairdresser:'Kapper'};
export const SHOP_TYPES=Object.keys(SHOP_LABELS);
export const SHOP_NAF_CODES=['10.71C','10.71D','47.24Z','10.13B','47.22Z','47.26Z','47.62Z','47.78C','47.72A','47.76Z','47.71Z','47.52A','47.52B','47.77Z','96.02A'];
export function shopType(tags:Record<string,string>):string|undefined{
 if(tags.disused==='yes'||tags.abandoned==='yes'||['private','no'].includes(tags.access))return;
 const types:Record<string,string>={bakery:'bakery',butcher:'butcher',tobacco:'tobacco',kiosk:'tobacco',newsagent:'tobacco',gift:'souvenirs',souvenir:'souvenirs',shoes:'shoes',florist:'florist',clothes:'fashion',fashion:'fashion',boutique:'fashion',hardware:'diy',doityourself:'diy',jewelry:'jeweller',hairdresser:'hairdresser'};
 return types[tags.shop];
}
export function shopNafType(code:string,name:string):string|undefined{
 const types:Record<string,string>={'10.71C':'bakery','10.71D':'bakery','47.24Z':'bakery','10.13B':'butcher','47.22Z':'butcher','47.26Z':'tobacco','47.62Z':'tobacco','47.72A':'shoes','47.71Z':'fashion','47.52A':'diy','47.52B':'diy','47.77Z':'jeweller','96.02A':'hairdresser'};
 // These two broad NAF codes also cover pet shops and unrelated goods.
 // Require positive evidence in the published business name.
 const normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(code==='47.76Z')return /fleur|florist|floral/.test(normalized)?'florist':undefined;
 if(code==='47.78C')return /souvenir|cadeau/.test(normalized)?'souvenirs':undefined;
 return types[code];
}
