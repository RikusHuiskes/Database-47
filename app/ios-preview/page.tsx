import {localizeMetadata} from '../i18n/server';
import type {Metadata} from 'next';
import DurasApp from './DurasApp';
const sourceMetadata:Metadata={title:'Cote de Duras · iOS-voorbeeld',description:'Het uitgebreide klikbare iPhone-voorbeeld van Cote de Duras: agenda, gemeentegids en favorieten.',manifest:'/ios-preview.webmanifest',robots:{index:false,follow:false},appleWebApp:{capable:true,title:'Cote de Duras',statusBarStyle:'default'},icons:{apple:'/cote-de-duras-ios-icon.png',icon:'/cote-de-duras-icon.png'}};
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}

export default function Page(){return <DurasApp/>;}
