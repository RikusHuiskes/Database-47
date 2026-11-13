"use client";

import {useState} from 'react';
import {eventDisplayImage, EVENT_LOGO_URL} from '../../lib/event-image.ts';

/** A broken source photo uses the same branded image as an absent photo. */
export default function EventImage({src,className='',loading='lazy'}:{src?:string|null;className?:string;loading?:'lazy'|'eager'}){
 const source=eventDisplayImage(src);
 const [failedSource,setFailedSource]=useState<string|null>(null);
 const logo=source===EVENT_LOGO_URL||failedSource===source;
 return <img className={`${className}${logo?' event-image-logo':''}`} src={logo?EVENT_LOGO_URL:source} alt={logo?'Côte de Duras':''} loading={loading} onError={()=>{if(!logo)setFailedSource(source);}}/>;
}
