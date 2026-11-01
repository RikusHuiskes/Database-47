import type {MunicipalPaidListing} from '../../lib/municipal-advertising-server';
import {hasAdvertisingPlacement} from '../../lib/event-presentation';
export default function MunicipalPartners({listings,city}:{listings:MunicipalPaidListing[];city:string}){
 if(!listings.length)return null;
 return <aside className="municipal-partner-rail" aria-label={'Adverteerders in '+city}><small>Lokale partners · Advertenties</small><h3>Uitgelicht in {city}</h3>{listings.map(listing=><a className="municipal-partner-card" key={listing.id} href={'/gemeentegids/adverteren?'+new URLSearchParams({serviceId:listing.municipal_key,city:listing.city})}>{listing.image_url&&/^https?:\/\//i.test(listing.image_url)?<img src={listing.image_url} alt=""/>:<span className="municipal-partner-initial" aria-hidden="true">{listing.title.slice(0,1)}</span>}<small>{hasAdvertisingPlacement({...listing,start_at:''},'homepage')?'Gemeentepartner':'Rubriekpartner'} · {city}</small><strong>{listing.title}</strong><p>{listing.short_description||listing.description||listing.address}</p><span>Ontdek →</span></a>)}</aside>;
}
