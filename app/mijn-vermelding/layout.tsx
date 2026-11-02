import {localizeMetadata} from '../i18n/server';
import type {Metadata} from 'next';
const sourceMetadata:Metadata={title:'Mijn vermelding | Côte de Duras',robots:{index:false,follow:false},referrer:'no-referrer'};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}

export default function ManagementLayout({children}:{children:React.ReactNode}){return children;}
