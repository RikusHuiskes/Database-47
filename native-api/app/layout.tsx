import type {Metadata} from 'next';
import '../../app/globals.css';
export const metadata:Metadata={title:'Cote de Duras',description:'Agenda en gemeentegids binnen 50 km rond Duras.',robots:{index:false,follow:false},manifest:'/ios-preview.webmanifest',appleWebApp:{capable:true,title:'Cote de Duras',statusBarStyle:'default'},icons:{apple:'/cote-de-duras-ios-icon.png',icon:'/cote-de-duras-icon.png'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="nl"><body style={{margin:0,fontFamily:'Arial,sans-serif'}}>{children}</body></html>;}
