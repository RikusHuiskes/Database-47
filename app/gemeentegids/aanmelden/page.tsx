import type {Metadata} from 'next';
import {localizeMetadata} from '../../i18n/server';
import BusinessSubmission from './BusinessSubmission';
export async function generateMetadata():Promise<Metadata>{return localizeMetadata({title:'Bedrijf aanmelden in de gemeentegids | Côte de Duras',description:'Meld je winkel of dienstverlening gratis aan in de gemeentegids van Côte de Duras.'});}
export default function Page(){return <BusinessSubmission/>;}
