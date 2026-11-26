import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { travauxPlans } from './travaux-plans.ts';
import { monthBoundary } from './recurring-billing.ts';

const migration = file => readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
const owner = '10000000-0000-4000-8000-000000000001';
const buyer = { address:'1 rue Test', postcode:'47120', city:'Duras', siret:'12345678900012' };
const invoiceProfile = { seller:{ name:'Côte de Duras', siret:'93451899400025' }, taxMode:'standard', vatRate:20, taxNote:'TVA 20 %' };
const source = stripTypeScriptTypes(readFileSync(new URL('./travaux-billing.ts', import.meta.url),'utf8'))
  .replace(/^import .*;$/gm, '').replaceAll('export ', '');

test('French Mollie checkout, webhook replay, card and SEPA renewals', async () => {
  for (const [plan, firstMethod] of [['monthly', 'paybybank'], ['monthly', 'creditcard'], ['annual', 'creditcard']]) {
    const recurringMethod = firstMethod === 'creditcard' ? 'creditcard' : 'directdebit';
    const profile = { user_id:owner, checkout_key:'key', customer_id:'cst_case', first_payment_id:null,
      subscription_id:null, billing_plan:null, test_mode:true, details:buyer };
    const calls = [], settled = [], payments = new Map();
    let subscription;
    function from(table) {
      if (table==='travaux_payments') return {select(){return this},eq(){return this},async maybeSingle(){return {data:null}}};
      assert.equal(table,'travaux_providers');
      const query = { select(){return this}, eq(){return this}, is(){return this}, or(){return this},
        upsert(){return Promise.resolve({error:null})}, update(values){Object.assign(profile,values);return this},
        async single(){return {data:profile}}, async maybeSingle(){return {data:profile}},
        then(resolve){resolve({error:null})} };
      return query;
    }
    const db = { from, async rpc(name,args){ assert.equal(name,'travaux_settle_payment'); settled.push(args);return {data:'invoice'}; } };
    async function mollie(path, options) {
      const body = options?.body && JSON.parse(options.body);
      calls.push({path,body});
      if (path === 'customers/cst_case/payments?limit=50') return {_embedded:{payments:[]}};
      if (path.startsWith('methods?')) {
        const params = new URLSearchParams(path.split('?')[1]);
        assert.equal(params.get('billingCountry'), 'FR');
        assert.equal(params.get('locale'), 'fr_FR');
        assert.equal(params.get('sequenceType'), plan === 'monthly' ? 'first' : 'oneoff');
        assert.equal(params.get('amount[value]'), travauxPlans[plan].amount);
        return { _embedded: { methods: ['ideal', 'creditcard', 'paybybank', 'banktransfer'].map(id => ({ id })) } };
      }
      if (path === 'payments') {
        const created = {...body,id:'tr_first',status:'open',mode:'test',createdAt:new Date().toISOString(),_links:{checkout:{href:'https://www.mollie.com/checkout/test'}}};
        payments.set(created.id,created);return created;
      }
      if (path.startsWith('payments/')) return payments.get(path.slice(9));
      if (path.includes('/mandates/')) return { status: 'valid', method: recurringMethod };
      if (path.endsWith('/subscriptions?limit=50')) return {_embedded:{subscriptions:subscription?[subscription]:[]}};
      if (path.endsWith('/subscriptions')) { subscription={...body,id:'sub_monthly'};return subscription; }
      throw Error('Unexpected Mollie call: '+path);
    }
    const deps = {
      termsVersion:'v4',monthBoundary,billingOrigin:()=> 'https://test.example',
      mollieRequest:mollie,isPaymentCheckoutUrl:()=>true,travauxPath:'/travaux',
      checked:r=>{if(r.error)throw r.error;return r.data},TravauxError:Error,travauxTestMode:()=>true,
      travauxPlans,mailConfiguration:()=>({deliveryEnabled:true}),loadAdvertisingInvoiceProfile:async()=>({profile:invoiceProfile}),
    };
    const {startTravauxCheckout,reconcileTravauxPayment}=new Function(...Object.keys(deps),source+';return {startTravauxCheckout,reconcileTravauxPayment};')(...Object.values(deps));
    const origin='https://test.example';
    const request=new Request(origin+'/api/travaux');
    const start=()=>startTravauxCheckout(db,request,owner,'artisan@example.test','Artisan','0500000000','fr',buyer,plan);
    assert.ok((await start()).checkoutUrl);
    assert.ok((await start()).checkoutUrl);
    assert.equal(calls.filter(x=>x.path==='payments').length,1);
    const payment=payments.get('tr_first');
    assert.equal(payment.amount.value,travauxPlans[plan].amount);
    assert.equal(payment.sequenceType,plan==='monthly'?'first':'oneoff');
    assert.equal(payment.billingAddress.country, 'FR');
    assert.equal(payment.locale, 'fr_FR');
    assert.deepEqual(payment.method,plan==='monthly'?['creditcard','paybybank']:['creditcard','paybybank','banktransfer']);
    await reconcileTravauxPayment(db,payment.id,origin);
    assert.equal(settled.length,0);
    payment.status='failed';
    await reconcileTravauxPayment(db,payment.id,origin);
    assert.equal(settled.length,0);
    payment.status='paid';payment.mandateId='mdt_test';payment.method=firstMethod;
    await reconcileTravauxPayment(db,payment.id,origin);
    await reconcileTravauxPayment(db,payment.id,origin);
    assert.equal(settled.length,2);
    assert.ok(settled.every(row=>row.p_plan===plan&&row.p_paid&&row.p_profile===invoiceProfile));
    assert.equal(calls.filter(x=>x.path==='customers/cst_case/subscriptions').length,plan==='monthly'?1:0);
    if (plan === 'monthly') {
      assert.equal(subscription.method, recurringMethod);
      payments.set('tr_next',{ ...payment,id:'tr_next',metadata:{},sequenceType:'recurring',method:recurringMethod,subscriptionId:'sub_monthly' });
      await reconcileTravauxPayment(db,'tr_next',origin);
      assert.equal(settled.at(-1).p_id,'tr_next');
    }
    payment.amount={currency:'EUR',value:'1.00'};
    const logged=settled.length;
    await reconcileTravauxPayment(db,payment.id,origin);
    assert.equal(settled.length,logged);
  }
});

test('database creates one invoice per settled payment, queues it once and sets coverage dates', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key);create table public.advertising_requests(id uuid primary key);create table public.events(id uuid primary key);`);
    await db.exec(migration('20261104170000_advertising_invoices.sql'));
    await db.exec(migration('20261125160000_travaux.sql'));
    await db.exec(migration('20261125170000_travaux_provider_profile.sql'));
    await db.exec(migration('20261125210000_travaux_billing_plans.sql'));
    await db.exec(migration('20261125220000_travaux_sepa_notice.sql'));
    await db.query('insert into auth.users values($1)',[owner]);
    await db.query(`insert into public.travaux_providers(user_id,name,email,phone,test_mode,details)
      values($1,'Artisan','artisan@example.test','0500000000',true,$2)`,[owner,buyer]);
    const settle=async (id,plan,day,paid=true,observed='2026-11-25T20:00:00Z')=>
      (await db.query('select public.travaux_settle_payment($1,$2,$3,$4,$5,$6,$7) as id',[id,owner,day,plan,paid,observed,paid?invoiceProfile:null])).rows[0].id;
    const annual=await settle('tr_annual','annual','2026-11-25');
    assert.equal(await settle('tr_annual','annual','2026-11-25'),annual);
    await settle('tr_month','monthly','2026-11-30');
    await settle('tr_renew','monthly','2026-12-30');
    assert.equal(await settle('tr_failed','monthly','2026-11-25',false),null);
    const coverage=(await db.query('select id,ends_on::text from public.travaux_payments where paid order by id')).rows;
    assert.deepEqual(coverage,[{id:'tr_annual',ends_on:'2027-11-25'},{id:'tr_month',ends_on:'2026-12-30'},{id:'tr_renew',ends_on:'2027-01-30'}]);
    const invoices=(await db.query('select travaux_payment_id,total_cents,net_cents,vat_cents from public.advertising_invoices order by travaux_payment_id')).rows;
    assert.deepEqual(invoices.map(row=>row.total_cents),[25000,2500,2500]);
    assert.ok(invoices.every(row=>row.net_cents+row.vat_cents===row.total_cents));
    assert.equal((await db.query('select count(*)::int as count from public.advertising_invoice_mail_outbox')).rows[0].count,3);
    assert.equal((await db.query('select count(*)::int as count from public.claim_advertising_invoice_mail(10)')).rows[0].count,3);
    assert.equal((await db.query('select count(*)::int as count from public.claim_advertising_invoice_mail(10)')).rows[0].count,0);
    assert.equal(await settle('tr_annual','annual','2026-11-25',false,'2026-11-25T20:01:00Z'),null);
    assert.equal(await settle('tr_annual','annual','2026-11-25'),null);
    await db.exec(`update public.travaux_payments set paid = false;
      update public.travaux_payments set paid = true,
        starts_on = (now() at time zone 'Europe/Paris')::date - 30,
        ends_on = (now() at time zone 'Europe/Paris')::date where id = 'tr_month';
      update public.travaux_providers set billing_plan = 'monthly', cancelled_at = now() - interval '1 day',
        notice_ends_on = (now() at time zone 'Europe/Paris')::date + 28;`);
    const hasAccess = async () => (await db.query('select public.travaux_paid($1, true) as active', [owner])).rows[0].active;
    assert.equal(await hasAccess(), true);
    await db.exec(`update public.travaux_providers set notice_ends_on = (now() at time zone 'Europe/Paris')::date;`);
    assert.equal(await hasAccess(), false);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.advertising_invoices'),/permission denied/);
  } finally { await db.close(); }
});
