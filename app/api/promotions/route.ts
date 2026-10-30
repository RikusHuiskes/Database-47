import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {promotionPlacements} from '../../../lib/event-presentation';

export const revalidate=0;
type PromotionRecord={id:string;start_at:string|null;event_categories?:{category_id:string}[];promotion_type?:string|null;promotion_status?:string|null;promotion_start_at?:string|null;promotion_end_at?:string|null;reserved_homepage?:boolean;reserved_category_id?:string|null};

/** Public advertising only: no ordinary results or geocoding on this path. */
export async function GET(request:NextRequest){
  const category=request.nextUrl.searchParams.get('category')??'all';
  if(category!=='all'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category))return NextResponse.json({error:'Kies een geldige categorie.'},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return NextResponse.json({error:'Advertenties zijn tijdelijk niet beschikbaar.'},{status:503});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const now=new Date().toISOString();
  const type=category==='all'?'homepage':'category';
  const reserved=category==='all'?'reserved_homepage.eq.true':'reserved_category_id.eq.'+category;
  const columns='id,title,slug,start_at,end_at,is_directory_entry,city,postcode,address,venue_name,short_description,description,image_url,is_free,website_url,booking_url,contact_phone,source_url,status,verified,promotion_type,promotion_status,promotion_start_at,promotion_end_at,reserved_homepage,reserved_category_id,event_categories'+(category==='all'?'':'!inner')+'(category_id)';
  let query=client.from('events').select(columns).eq('status','approved').eq('verified',true)
    .or(reserved+',and(promotion_type.eq.'+type+',promotion_status.eq.active,or(promotion_start_at.is.null,promotion_start_at.lte.'+now+'),or(promotion_end_at.is.null,promotion_end_at.gt.'+now+'))');
  if(category!=='all')query=query.eq('event_categories.category_id',category);
  const {data,error}=await query.order('id').limit(100);
  if(error)return NextResponse.json({error:'Advertenties konden niet worden geladen.'},{status:502});
  const rows=((data??[]) as unknown as PromotionRecord[]).map(record=>{const {event_categories,...event}=record;return {...event,start_at:event.start_at??'',category_ids:(event_categories??[]).map(link=>link.category_id)};});
  const placements=promotionPlacements(rows,category);
  return NextResponse.json({homepage_promotions:placements.homepage,category_promotions:placements.category});
}
