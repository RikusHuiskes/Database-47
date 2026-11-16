import type {Metadata} from 'next';
import ChristmasCampaign from '../campagnes/kerstmarkten/ChristmasCampaign';
const url='https://www.cotededuras.com/marches-de-noel';
export const metadata:Metadata={title:'Marchés de Noël autour de Duras 2026 | Côte de Duras',description:'Découvrez les marchés de Noël à Duras et dans un rayon de 50 km. Les plus proches en premier : choisissez vos dates et préparez votre sortie.',alternates:{canonical:url},robots:{index:true,follow:true},openGraph:{type:'website',url,title:'La magie de Noël autour de Duras',description:'Marchés de Noël, idées cadeaux et sorties dans un rayon de 50 km. Choisissez votre date.',images:[{url:url+'/opengraph-image',width:1200,height:630}]},twitter:{card:'summary_large_image',title:'Les marchés de Noël autour de Duras',images:[url+'/opengraph-image']}};
export default function ChristmasPage(){return <ChristmasCampaign/>;}
