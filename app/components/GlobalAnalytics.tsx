'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {ANALYTICS_PAGES} from '../../lib/marketing-attribution';
const Consent=dynamic(()=>import('./AnalyticsConsent'),{ssr:false});
export default function GlobalAnalytics(){
 const path=usePathname();const [blocked,setBlocked]=useState(true);const travaux=path==='/travaux';
 useEffect(()=>{
  if(travaux)return;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return;
  const client=createClient(url,key);let active=true;let revision=0;
  async function check(user:boolean){const id=++revision;if(!user){if(active)setBlocked(false);return}const result=await client.rpc('is_admin');if(active&&id===revision)setBlocked(result.error?true:result.data===true)}
  void client.auth.getSession().then(({data,error})=>{if(!error)void check(!!data.session)});
  const {data}=client.auth.onAuthStateChange((_event,session)=>{setBlocked(true);queueMicrotask(()=>{if(active)void check(!!session)})});
  return()=>{active=false;data.subscription.unsubscribe()};
 },[travaux]);
 if(!ANALYTICS_PAGES.includes(path))return null;
 return <Consent disabled={blocked}/>;
}
