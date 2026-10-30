import {mailConfiguration} from '../../../lib/mail';
export const maxDuration=300;
import {after} from 'next/server';
import {processMailOutbox} from '../../../lib/mail-outbox';
import {createServiceClient} from '../../../lib/supabase-server';
import {listingRequestInput} from '../../../lib/listing-request';
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'Ongeldige aanvraag.'},{status:403});
  try {
    const text = await request.text();
    if (text.length > 12000) throw Error('De aanvraag is te groot.');
    const input = listingRequestInput(JSON.parse(text));
    const client = createServiceClient();
    if (!client) return Response.json({error:'Aanvragen is tijdelijk niet beschikbaar.'},{status:503});
    const {data,error} = await client.rpc('submit_listing_request',{p_request:input});
    if (error) throw Error(error.message);
    after(async()=>{await processMailOutbox().catch(()=>{});});
    return Response.json({reference:data,emailEnabled:mailConfiguration().deliveryEnabled,emailPreview:mailConfiguration().previewMode},{status:201,headers:{'Cache-Control':'no-store'}});
  } catch (e) { return Response.json({error:e instanceof Error?e.message:'Aanvragen mislukt.'},{status:400}); }
}
