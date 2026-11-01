import type {Metadata} from 'next';
import AdvertisingPreview from './AdvertisingPreview';
export const metadata:Metadata={title:'Adverteren in de gemeentegids | Côte de Duras',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const text=(key:string,fallback:string)=>typeof params[key]==='string'?params[key].trim().slice(0,250)||fallback:fallback;
 return <AdvertisingPreview name={text('name','Voorbeeldbakkerij')} city={text('city','Duras')} category={text('category','Bakkerij')} address={text('address','')} />;
}
