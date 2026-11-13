import {adminService} from '../../../../lib/admin-service';
import {loadAdvertisingInvoiceProfile,processAdvertisingInvoiceMailOutbox,validateInvoiceSettings} from '../../../../lib/advertising-invoices';
import {mailConfiguration} from '../../../../lib/mail';
export async function GET(request:Request){
  const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
  const raw=Number(new URL(request.url).searchParams.get('page')??1),page=Number.isSafeInteger(raw)&&raw>0?raw:1;
  const [result,summaryResult,settingsResult]=await Promise.all([
    client.from('advertising_requests').select('id,event_id,placement,details,starts_on,ends_on,months,amount_cents,payment_status,is_test_mode,created_at,events(id,title,city,municipal_key,municipal_type,archived_at),advertising_invoices(invoice_number,issued_at,state,is_test_mode,net_cents,vat_cents,total_cents,advertising_invoice_mail_outbox(state,accepted_at,last_error))',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*10,page*10-1),
    client.rpc('advertising_invoice_summary'),
    client.from('advertising_invoice_settings').select('tax_mode,vat_rate,vat_number,tax_note,price_basis,updated_at').eq('id',1).maybeSingle()
  ]);
  if(result.error||summaryResult.error||settingsResult.error)return Response.json({error:'Advertentie- en factuurgegevens konden niet worden geladen.'},{status:502});
  const checked=validateInvoiceSettings(settingsResult.data);
  const mail=mailConfiguration();
  return Response.json({items:result.data,total:result.count,page,summary:summaryResult.data,settings:settingsResult.data,invoiceSetupReady:Boolean(checked.settings),invoiceSetupMissing:checked.missing,mailConfigured:mail.configured,mailDeliveryEnabled:mail.deliveryEnabled,previewMode:mail.previewMode},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Ongeldige aanvraag.'},{status:403});
 const client=await adminService(request);if(!client)return Response.json({error:'Beheerderstoegang vereist.'},{status:403});
 try{
  const body=await request.json();
  if(body.action==='archive-listing'){
   if(typeof body.eventId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.eventId))return Response.json({error:'Vermelding niet gevonden.'},{status:400});
   const result=await client.rpc('archive_event',{p_event_id:body.eventId});
   if(result.error)return Response.json({error:'De vermelding kon niet worden verwijderd.'},{status:409});
   return Response.json({message:'De vermelding is uit de actieve lijst verwijderd. Factuurhistorie blijft bewaard.'},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='delete-test'){
   if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))return Response.json({error:'Testaanvraag niet gevonden.'},{status:400});
   const result=await client.rpc('delete_test_advertising_request',{p_request_id:body.requestId});
   if(result.error)return Response.json({error:'Alleen een als test gemarkeerde aanvraag kan worden verwijderd.'},{status:409});
   return Response.json({message:'De testaanvraag is uit de lijst verwijderd.'},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='issue-invoice'){
   if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))return Response.json({error:'Advertentieaanvraag niet gevonden.'},{status:400});
   const loaded=await loadAdvertisingInvoiceProfile(client);
   if(!loaded.profile)return Response.json({error:'Factuurinstellingen zijn nog niet compleet. Ontbreekt: '+loaded.missing.join(', ')+'.'},{status:409});
   const issued=await client.rpc('issue_advertising_invoice',{p_request_id:body.requestId,p_profile:loaded.profile,p_test_mode:process.env.VERCEL_ENV!=='production'});
   if(issued.error)return Response.json({error:'De factuur kon niet worden uitgegeven. Controleer of deze aanvraag al een factuur heeft.'},{status:409});
   const mail=await processAdvertisingInvoiceMailOutbox(1);
   const config=mailConfiguration();
   return Response.json({message:`Factuur opgesteld.${mail.enabled?` ${mail.accepted} e-mail(s) door Strato geaccepteerd; ${mail.failed} mislukt.`:' De factuurmail staat klaar, maar automatische verzending staat uit.'}${config.previewMode?' Previewmail gaat uitsluitend naar de eigen mailbox.':''}`,invoiceId:issued.data,mail},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='save-settings'){
   const checked=validateInvoiceSettings(body.settings);
   if(!checked.settings)return Response.json({error:'Vul de factuurgegevens volledig in: '+checked.missing.join(', ')+'.'},{status:400});
   const saved=await client.from('advertising_invoice_settings').upsert({id:1,...checked.settings,updated_at:new Date().toISOString()},{onConflict:'id'});
   if(saved.error)return Response.json({error:'Factuurinstellingen konden niet worden opgeslagen.'},{status:502});
   return Response.json({message:'Factuurinstellingen opgeslagen. Je kunt nu per aanvraag handmatig een factuur opstellen.'},{headers:{'Cache-Control':'no-store'}});
  }else if(body.action!=='process')return Response.json({error:'Ongeldige actie.'},{status:400});
  const mail=await processAdvertisingInvoiceMailOutbox(10);
  const config=mailConfiguration();
  return Response.json({message:`Geen facturen aangemaakt. E-mailwachtrij verwerkt: ${mail.enabled?`${mail.accepted} mail(s) door Strato geaccepteerd; ${mail.failed} mislukt.`:'verzending staat uit.'}${config.previewMode?' Previewmail gaat uitsluitend naar de eigen mailbox.':''}`,mail},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'De factuuractie is niet afgerond. Controleer de instellingen en probeer opnieuw.'},{status:502});}
}
