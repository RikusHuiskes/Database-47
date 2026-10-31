'use client';
import {useState} from 'react';

/** A removed publisher image must not leave a broken-image icon in the agenda. */
export default function SourcePhoto({src,title,className}:{src?:string|null;title:string;className?:string}){
 const [failed,setFailed]=useState<string|null>(null);
 if(!src||failed===src)return <span className="activity-image-placeholder"><span aria-hidden="true">▧</span><small>Geen bronfoto beschikbaar</small></span>;
 return <img className={className} src={src} alt={`Foto bij ${title}`} loading="lazy" decoding="async" onError={()=>setFailed(src)}/>;
}
