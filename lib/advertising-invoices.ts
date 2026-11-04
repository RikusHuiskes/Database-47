import {ADVERTISING_SELLER} from './mollie';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createServiceClient} from './supabase-server';
import {mailConfiguration,mailTransport,safeMailError} from './mail';

export type InvoiceSettings={tax_mode:'standard'|'franchise_exempt';vat_rate:number;vat_number:string|null;tax_note:string;price_basis:'tax_inclusive'};
export type InvoiceProfile={seller:typeof ADVERTISING_SELLER&{vatNumber:string};taxMode:'standard'|'franchise_exempt';vatRate:number;vatNumber:string|null;taxNote:string;priceBasis:'tax_inclusive'};

export function validateInvoiceSettings(input:unknown):{settings:InvoiceSettings|null;missing:string[]} {
 const value=input&&typeof input==='object'?input as Record<string,unknown>:{};
 const mode=value.tax_mode==='standard'||value.tax_mode==='franchise_exempt'?value.tax_mode:null;
 const rate=typeof value.vat_rate==='number'?value.vat_rate:Number(value.vat_rate);
 const vatNumber=typeof value.vat_number==='string'?value.vat_number.trim():'';
 const taxNote=typeof value.tax_note==='string'?value.tax_note.trim():'';
 const missing:string[]=[];
 if(!mode)missing.push('btw-regime');
 if(value.price_basis!=='tax_inclusive')missing.push('prijs inclusief btw bevestigen');
 if(!taxNote)missing.push(mode==='standard'?'btw-vermelding':'vrijstellingsvermelding');
 if(mode==='standard'&&(!Number.isFinite(rate)||rate<=0||rate>25))missing.push('geldig btw-tarief');
 if(mode==='standard'&&!vatNumber)missing.push('btw-nummer');
 if(mode==='standard'&&vatNumber&&!/^FR\d{11}$/.test(vatNumber.toUpperCase()))missing.push('Frans btw-nummer in de vorm FR + 11 cijfers');
 if(mode==='franchise_exempt'&&Number.isFinite(rate)&&rate!==0)missing.push('btw-tarief 0%');
 if(missing.length)return {settings:null,missing};
 return {settings:{tax_mode:mode!,vat_rate:mode==='standard'?rate:0,vat_number:mode==='standard'?vatNumber:null,tax_note:taxNote,price_basis:'tax_inclusive'},missing:[]};
}

export async function loadAdvertisingInvoiceProfile(client?:SupabaseClient|null){
 const service=client??createServiceClient();
 if(!service)return {profile:null,settings:null as InvoiceSettings|null,missing:['databaseverbinding']};
 const {data,error}=await service.from('advertising_invoice_settings').select('tax_mode,vat_rate,vat_number,tax_note,price_basis').eq('id',1).maybeSingle();
 if(error||!data)return {profile:null,settings:null as InvoiceSettings|null,missing:['factuurinstellingen']};
 const checked=validateInvoiceSettings(data);
 if(!checked.settings)return {profile:null,settings:null as InvoiceSettings|null,missing:checked.missing};
 return {profile:{seller:{...ADVERTISING_SELLER,vatNumber:checked.settings.vat_number??''},taxMode:checked.settings.tax_mode,vatRate:checked.settings.vat_rate,vatNumber:checked.settings.vat_number,taxNote:checked.settings.tax_note,priceBasis:checked.settings.price_basis} satisfies InvoiceProfile,settings:checked.settings,missing:[]};
}

type Snapshot={invoiceNumber:string;issuedAt:string;currency:string;seller:Record<string,string>;customer:Record<string,string>;lineDescription:string;startsOn:string;endsOn:string;netCents:number;vatCents:number;totalCents:number;vatRate:number;taxMode:string;taxNote:string};
type QueueRow={id:string;invoice_id:string;recipient:string;attempts:number;lease_token:string};
const amount=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
const date=(value:string)=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'Europe/Paris'}).format(new Date(value));

const cp1252Special=new Map<number,number>([[0x20ac,0x80],[0x201a,0x82],[0x0192,0x83],[0x201e,0x84],[0x2026,0x85],[0x2020,0x86],[0x2021,0x87],[0x02c6,0x88],[0x2030,0x89],[0x0160,0x8a],[0x2039,0x8b],[0x0152,0x8c],[0x017d,0x8e],[0x2018,0x91],[0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],[0x02dc,0x98],[0x2122,0x99],[0x0161,0x9a],[0x203a,0x9b],[0x0153,0x9c],[0x017e,0x9e],[0x0178,0x9f]]);
function pdfHex(value:string){return Array.from(value).map(char=>{const cp=char.codePointAt(0)??63;const byte=cp1252Special.get(cp)??(cp<=255?cp:63);return byte.toString(16).padStart(2,'0');}).join('').toUpperCase();}
function wrapPdfText(value:string,max=78){const words=String(value??'').replace(/\s+/g,' ').trim().split(' ');const lines:string[]=[];let line='';for(const word of words){if(!word)continue;if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;}
export function advertisingInvoicePdf(snapshot:Snapshot){
 const s=snapshot.seller,c=snapshot.customer;
 const lines:[number,string,number,boolean][]=[];
 const add=(y:number,text:string,size=10,bold=false)=>lines.push([y,text,size,bold]);
 add(790,String(s.name??'Côte de Duras'),20,true);
 add(770,[s.address,s.postcode,s.city,s.country].filter(Boolean).join(' · '),9);
 add(754,`SIRET : ${s.siret??''}`,9);
 if(s.vatNumber)add(740,`TVA intracommunautaire : ${s.vatNumber}`,9);
 add(695,'FACTURE',22,true);
 add(667,`N° ${snapshot.invoiceNumber}`,12,true);
 add(647,`Émise le ${date(snapshot.issuedAt)}`,10);
 add(604,'FACTURÉ À',10,true);
 let y=584;
 for(const line of [c.company,c.name,c.address,[c.postcode,c.city].filter(Boolean).join(' '),c.vatNumber?`N° TVA : ${c.vatNumber}`:''].filter((x):x is string=>Boolean(x))){for(const part of wrapPdfText(line,65)){add(y,part,10);y-=16;}}
 y-=20;
 add(y,'PRESTATION',9,true);add(y-20,wrapPdfText(snapshot.lineDescription,75)[0]??'',10);
 let descriptionLines=wrapPdfText(snapshot.lineDescription,75);for(let i=1;i<descriptionLines.length;i++)add(y-20-i*15,descriptionLines[i],10);
 const tableY=y-60-Math.max(0,descriptionLines.length-1)*15;
 add(tableY,`Période : ${date(snapshot.startsOn)} – ${date(snapshot.endsOn)}`,9);
 add(tableY-30,`Montant hors taxe : ${amount(snapshot.netCents)}`,10);
 add(tableY-49,`TVA ${snapshot.vatRate}% : ${amount(snapshot.vatCents)}`,10);
 add(tableY-78,`TOTAL TTC : ${amount(snapshot.totalCents)}`,14,true);
 add(tableY-132,snapshot.taxNote,9);
 add(54,`${s.name??'Côte de Duras'} · SIRET ${s.siret??''}`,8);
 let stream='';
 for(const [pos,text,size,bold] of lines){if(pos<28)continue;stream+=`BT /${bold?'F2':'F1'} ${size} Tf 48 ${pos} Td <${pdfHex(text)}> Tj ET\n`;}
 const objects:string[]=[];
 objects.push('<< /Type /Catalog /Pages 2 0 R >>');
 objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>');
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`);
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(new TextEncoder().encode(pdf).length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=new TextEncoder().encode(pdf).length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new TextEncoder().encode(pdf);
}

function invoiceEmail(snapshot:Snapshot){return {subject:`Côte de Duras — facture ${snapshot.invoiceNumber}`,text:`Bonjour ${snapshot.customer.name||''},\n\nMerci pour votre commande. Vous trouverez en pièce jointe votre facture ${snapshot.invoiceNumber}.\n\nPrestation : ${snapshot.lineDescription}\nMontant TTC : ${amount(snapshot.totalCents)}\n\nCordialement,\nCôte de Duras\n${snapshot.seller.name}\n${snapshot.seller.address}, ${snapshot.seller.postcode} ${snapshot.seller.city}\nSIRET ${snapshot.seller.siret}`};}

export async function processAdvertisingInvoiceMailOutbox(limit=10){
 const config=mailConfiguration();if(!config.deliveryEnabled)return {enabled:false,accepted:0,failed:0};
 const client=createServiceClient();if(!client)throw Error('Serververbinding ontbreekt.');
 const {data,error}=await client.rpc('claim_advertising_invoice_mail',{p_limit:Math.min(10,Math.max(1,limit))});
 if(error)throw Error('De factuurmailwachtrij kon niet worden geopend.');
 let accepted=0,failed=0;
 for(const row of (data??[]) as QueueRow[]){
  try{
   const {data:invoice,error:loadError}=await client.from('advertising_invoices').select('id,invoice_number,issued_at,currency,net_cents,vat_cents,total_cents,snapshot').eq('id',row.invoice_id).maybeSingle();
   if(loadError||!invoice)throw Error('De factuur kon niet worden geladen.');
   const snapshot=invoice.snapshot as Snapshot;const message=invoiceEmail(snapshot);
   const preview=config.previewMode;
   const outgoing=preview?{...message,subject:'[TEST PREVIEW] '+message.subject,text:`TESTBERICHT — uitsluitend naar je eigen mailbox.\nOorspronkelijke ontvanger: ${row.recipient}\n\n${message.text}`} :message;
   const info=await mailTransport().sendMail({from:config.from,to:preview?config.user:row.recipient,replyTo:config.user,...outgoing,messageId:`<advertising-invoice-${invoice.id}@cotededuras.com>`,attachments:[{filename:`Factuur-${invoice.invoice_number}.pdf`,content:Buffer.from(advertisingInvoicePdf(snapshot)),contentType:'application/pdf'}]});
   if(!info.accepted?.length)throw Error('Geen ontvanger geaccepteerd.');
   const update=await client.from('advertising_invoice_mail_outbox').update({state:'accepted',accepted_at:new Date().toISOString(),last_error:null,lease_token:null}).eq('id',row.id).eq('lease_token',row.lease_token);
   if(update.error)throw Error('Verzendstatus kon niet worden opgeslagen.');accepted++;
  }catch(error){
   failed++;
   await client.from('advertising_invoice_mail_outbox').update({state:row.attempts>=5?'failed':'pending',last_error:safeMailError(error),next_attempt_at:new Date(Date.now()+Math.min(1440,5*2**row.attempts)*60000).toISOString(),lease_token:null}).eq('id',row.id).eq('lease_token',row.lease_token);
  }
 }
 return {enabled:true,accepted,failed};
}
