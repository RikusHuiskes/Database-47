import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

// Only the same public category fields already used by the website are exposed.
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.json({error:'Categorieën zijn tijdelijk niet beschikbaar.'},{status:503});
 try{
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.from('categories').select('id,name,slug').eq('active',true).order('name').limit(100).abortSignal(AbortSignal.timeout(10000));
  if(error)return NextResponse.json({error:'Categorieën konden niet worden geladen.'},{status:502});
  return NextResponse.json({categories:data??[]},{headers:{'Cache-Control':'public, max-age=60, s-maxage=300'}});
 }catch{return NextResponse.json({error:'Categorieën konden niet worden geladen.'},{status:503});}
}
