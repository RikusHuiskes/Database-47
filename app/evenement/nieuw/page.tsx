import type {Metadata} from 'next';
import DurasSite from '../../DurasSite';
export const metadata:Metadata={title:'Nieuwe vermelding en adverteren | Côte de Duras',robots:{index:false,follow:false}};
export default function Page(){return <DurasSite newListingOnly/>;}
