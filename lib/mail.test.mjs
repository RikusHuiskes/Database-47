import test from 'node:test';
import assert from 'node:assert/strict';
import {mailConfiguration,listingMail,safeMailError} from './mail.ts';
test('Strato configuration requires TLS and secrets stay out of configuration responses',()=>{
 const env={SMTP_HOST:'smtp.strato.de',SMTP_PORT:'465',SMTP_USER:'info@cotededuras.com',SMTP_PASSWORD:'test-only-password',MAIL_FROM:'Côte de Duras <info@cotededuras.com>',VERCEL_ENV:'preview',MAIL_DELIVERY_ENABLED:'true'};
 const config=mailConfiguration(env);assert.equal(config.configured,true);assert.equal(config.deliveryEnabled,true);assert.equal(config.previewMode,true);assert(!JSON.stringify(config).includes(env.SMTP_PASSWORD));
 assert.equal(mailConfiguration({...env,VERCEL_ENV:'production'}).deliveryEnabled,true);
 assert.equal(mailConfiguration({...env,VERCEL_ENV:'production',MAIL_DELIVERY_ENABLED:'false'}).deliveryEnabled,false);
 for(const patch of [{SMTP_HOST:'attacker.invalid'},{SMTP_PORT:'25'},{SMTP_PASSWORD:''},{MAIL_FROM:'Côte\r\nBcc: other@example.invalid'}])assert.equal(mailConfiguration({...env,...patch}).configured,false);
 assert.deepEqual(mailConfiguration({...env,SMTP_PASSWORD:''}).missing,['SMTP_PASSWORD']);
});
test('Templates never grant access or disclose a management token',()=>{
 const received=listingMail('received',{title:'Een gîte',kind:'claim',reference:'reference'});
 assert.match(received.text,/geen beheerrechten/);assert.match(received.text,/reference/);
 const admin=listingMail('received',{audience:'admin',kind:'claim',title:'Gîte',reference:'ref'});assert.match(admin.text,/log in als beheerder/);assert(!admin.text.includes('beheerlink#'));
 const approved=listingMail('decision',{status:'approved',title:'Gîte',reference:'reference'});
 assert.match(approved.text,/afzonderlijk/);assert(!approved.text.includes('#'));
 assert.throws(()=>listingMail('decision',{status:'unknown'}));
 assert(!safeMailError({code:'EAUTH',message:'password=secret'}).includes('secret'));
});

test('Admin activity messages identify review queues, payment state and daily import failures',()=>{
 const submission=listingMail('received',{audience:'admin',kind:'submission',directory:true,title:'Test shop',reference:'id'});
 assert.match(submission.text,/Bedrijven beheren/);
 const change=listingMail('received',{audience:'admin',kind:'change',title:'Test event'});
 assert.match(change.text,/Wacht op controle/);
 const payment=listingMail('received',{audience:'admin',kind:'payment',status:'paid',amountCents:1500,test:true});
 assert.match(payment.subject,/\[TEST\]/);assert.match(payment.text,/Betaald/);assert.match(payment.text,/15,00/);
 const report=listingMail('received',{audience:'admin',kind:'import_failure',summary:'import-eymet: controle nodig'});
 assert.match(report.subject,/aandacht/);assert.match(report.text,/import-eymet: controle nodig/);
});
