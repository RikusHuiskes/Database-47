import MunicipalServicePhoto from './MunicipalServicePhoto';
import type {MunicipalPaidListing} from '../../lib/municipal-advertising-server';
import {hasAdvertisingPlacement} from '../../lib/event-presentation';
export default function MunicipalPartners({listings,city}:{listings:MunicipalPaidListing[];city:string}){
 if(!listings.length)return null;
 return <aside className="municipal-partner-rail" aria-label={'Adverteerders in '+city}><small>Lokale partners · Advertenties</small><h3>Uitgelicht in {city}</h3>{listings.map(listing=><article className="municipal-partner-card" key={listing.id}><MunicipalServicePhoto {...listing} image_url={listing.image_url||undefined} name={listing.title}/><a href={'/gemeentegids/adverteren?'+new URLSearchParams({serviceId:listing.municipal_key,city:listing.city})}><small>{hasAdvertisingPlacement({...listing,start_at:''},'homepage')?'Gemeentepartner':'Rubriekpartner'} · {city}</small><strong>{listing.title}</strong><p>{listing.short_description||listing.description||listing.address}</p><span>Ontdek →</span></a></article>)}</aside>;
}
