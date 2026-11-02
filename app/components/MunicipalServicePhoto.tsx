"use client";
import {T, A} from '../i18n/Language';

import {useState} from 'react';
import type {MunicipalPhoto} from '../../lib/municipal-photos';

export default function MunicipalServicePhoto({name, image_url, image_source_url, image_credit, image_license, image_license_url}: Partial<MunicipalPhoto> & {name:string}) {
  const [failedUrl,setFailedUrl]=useState('');
  const [portraitUrl,setPortraitUrl]=useState('');
  const safe=(url?:string)=>!!url&&(/^https?:\/\//i.test(url)||url.startsWith('/municipal-photos/'));
  if(!safe(image_url)||failedUrl===image_url)return <p className="municipal-photo-unavailable"><T>{"Foto nog niet beschikbaar"}</T></p>;
  return <figure className="municipal-service-photo">
    <A><img src={image_url} alt={name} loading="lazy" decoding="async" width={800} height={500} referrerPolicy="no-referrer" style={{objectFit:portraitUrl===image_url?'contain':'cover'}} onLoad={event=>{if(event.currentTarget.naturalHeight>event.currentTarget.naturalWidth*1.1)setPortraitUrl(image_url||'');}} onError={()=>setFailedUrl(image_url||'')}/></A>
    <T>{(image_source_url||image_credit)&&<figcaption><T>{safe(image_source_url)?<a href={image_source_url} target="_blank" rel="noreferrer"><T>{"Foto: "}</T><T>{image_credit||'bron bekijken'}</T><T>{" ↗"}</T></a>:<span><T>{"Foto: "}</T><T>{image_credit}</T></span>}</T><T>{image_license&&<><T>{" · "}</T><T>{safe(image_license_url)?<a href={image_license_url} target="_blank" rel="noreferrer"><T>{image_license}</T></a>:image_license}</T><T>{" · verkleind"}</T></>}</T></figcaption>}</T>
  </figure>;
}
