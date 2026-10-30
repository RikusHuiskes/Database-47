type Request={kind:string;email:string;created_at:string;events?:{website_url?:string|null;source_url?:string|null}|null};
function domain(value:string|undefined|null){try{const url=new URL(value??'');return /^https?:$/.test(url.protocol)?url.hostname.toLowerCase().replace(/^www\./,''):'';}catch{return '';}}
export function listingTriage(item:Request){
 if(item.kind==='correction')return {route:'correction',label:'Correctie controleren',reason:'Controleer het voorstel tegen de oorspronkelijke bron. Geen beheerrechten verlenen.'};
 const officialDomain=domain(item.events?.website_url),emailDomain=item.email.split('@')[1]?.toLowerCase();
 const shared=['gmail.com','hotmail.com','outlook.com','yahoo.com','orange.fr','wanadoo.fr','gites-de-france-47.com','booking.com','airbnb.com','facebook.com','instagram.com'];
 if(officialDomain&&officialDomain===emailDomain&&!shared.includes(officialDomain))return {route:'contact_verification',label:'Contactverificatie voorbereiden',reason:'Het e-maildomein komt overeen met de bestaande website. Dit is alleen een aanwijzing: controleer de officiële bron en bevestig toegang tot het bevoegde contactkanaal.'};
 return {route:'independent_check',label:'Onafhankelijke controle nodig',reason:'Het e-mailadres kan niet aan de bestaande website worden gekoppeld. Zoek zelf het officiële contactkanaal; neem de aangeleverde gegevens niet over als bewijs.'};
}
