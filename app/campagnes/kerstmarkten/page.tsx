import type {Metadata} from 'next';
import ChristmasCampaign from './ChristmasCampaign';
export const metadata:Metadata={title:'Marchés de Noël autour de Duras | Côte de Duras',description:'Trouvez les marchés de Noël dans un rayon de 50 km autour de Duras.',robots:{index:false,follow:false},openGraph:{title:'Marchés de Noël autour de Duras',description:'Une escapade de Noël à deux pas de chez vous.'}};
export default function ChristmasPage(){return <ChristmasCampaign/>;}
