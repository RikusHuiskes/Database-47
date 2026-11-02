
import {T, A} from '../i18n/Language';
import MunicipalServicePhoto from './MunicipalServicePhoto';
import type {MunicipalPaidListing} from '../../lib/municipal-advertising-server';
import {hasAdvertisingPlacement} from '../../lib/event-presentation';
export default function MunicipalPartners({listings,city}:{listings:MunicipalPaidListing[];city:string}){
 if(!listings.length)return null;
 return <A><aside className="municipal-partner-rail" aria-label={'Adverteerders in '+city}><small><T>{"Lokale partners · Advertenties"}</T></small><h3><T>{"Uitgelicht in "}</T><T>{city}</T></h3><T>{listings.map(listing=><article className="municipal-partner-card" key={listing.id}><MunicipalServicePhoto {...listing} image_url={listing.image_url||undefined} name={listing.title}/><a href={'/gemeentegids/adverteren?'+new URLSearchParams({serviceId:listing.municipal_key,city:listing.city})}><small><T>{hasAdvertisingPlacement({...listing,start_at:''},'homepage')?'Gemeentepartner':'Rubriekpartner'}</T><T>{" · "}</T><T>{city}</T></small><strong><T>{listing.title}</T></strong><p><T>{listing.short_description||listing.description||listing.address}</T></p><span><T>{"Ontdek →"}</T></span></a></article>)}</T></aside></A>;
}
