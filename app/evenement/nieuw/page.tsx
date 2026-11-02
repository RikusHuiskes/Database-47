import {localizeMetadata} from '../../i18n/server';
import type {Metadata} from 'next';
import DurasSite from '../../DurasSite';
const sourceMetadata:Metadata={title:'Nieuwe vermelding en adverteren | Côte de Duras',robots:{index:false,follow:false}};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}

export default function Page(){return <DurasSite newListingOnly/>;}
