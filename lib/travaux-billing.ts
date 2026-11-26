import { termsVersion, type CompanyDetails } from './travaux-company';
import type { Locale } from './i18n';
import { monthBoundary } from './recurring-billing';
import { loadAdvertisingInvoiceProfile } from './advertising-invoices';
import { mailConfiguration } from './mail';
import { travauxPlans, type TravauxPlan } from './travaux-plans';
import { billingOrigin } from './recurring-server';
import { mollieRequest } from './mollie';
import { isPaymentCheckoutUrl } from './payment-checkout-url';
import { travauxPath } from './travaux';
import { checked, TravauxError, travauxTestMode, type TravauxDb } from './travaux-server';

const amountFor = (plan: TravauxPlan) => ({ value: travauxPlans[plan].amount, currency: 'EUR' });
const product = 'travaux-cote-de-duras';
const description = 'Côte de Duras — Abonnement Travaux';
const parisDay = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

function molliePost(path: string, idempotencyKey: string, body: object) {
  return mollieRequest(path, {
    method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body),
  });
}

async function frenchCheckoutMethods(plan: TravauxPlan) {
  const params = new URLSearchParams({
    sequenceType: plan === 'monthly' ? 'first' : 'oneoff',
    locale: 'fr_FR', billingCountry: 'FR',
    'amount[currency]': 'EUR', 'amount[value]': amountFor(plan).value,
  });
  const data = await mollieRequest('methods?' + params);
  const methods = (data._embedded?.methods ?? []).map((method: { id: string }) => method.id) as string[];
  const frenchMethods = plan === 'monthly' ? ['creditcard', 'paybybank'] : ['creditcard', 'paybybank', 'banktransfer'];
  const available = frenchMethods.filter(method => methods.includes(method));
  if (!available.length) throw new TravauxError('Les paiements par carte ou banque française sont temporairement indisponibles.', 503);
  return available;
}

function travauxBillingOrigin(request: Request) {
  const origin = billingOrigin(request);
  if (origin !== new URL(request.url).origin) {
    throw new TravauxError('Ouvrez la page depuis son adresse officielle pour procéder au paiement.', 403);
  }
  return origin;
}

export async function startTravauxCheckout(db: TravauxDb, request: Request, userId: string, email: string, name: string, phone: string, locale: Locale, details: CompanyDetails, plan: TravauxPlan) {
  const origin = travauxBillingOrigin(request);
  if (!mailConfiguration().deliveryEnabled || !(await loadAdvertisingInvoiceProfile(db)).profile) {
    throw new TravauxError('La facturation par e-mail est temporairement indisponible.', 503);
  }
  const amount = amountFor(plan);
  checked(await db.from('travaux_providers').upsert({
    user_id: userId, email, name, phone, details, test_mode: travauxTestMode(),
  }, { onConflict: 'user_id', ignoreDuplicates: true }));
  let profile = checked(await db.from('travaux_providers').select('*').eq('user_id', userId).single());
  if (profile.test_mode !== travauxTestMode()) throw new TravauxError('Ce profil appartient à un autre environnement de paiement.', 409);
  const resetCheckout = async () => checked(await db.from('travaux_providers').update({
    checkout_key: crypto.randomUUID(), first_payment_id: null, billing_plan: null,
    subscription_id: null, cancelled_at: null, notice_ends_on: null,
  }).eq('user_id', userId).eq('checkout_key', profile.checkout_key).select('*').single());
  if ((profile.billing_plan === 'annual' || profile.cancelled_at) && profile.first_payment_id) {
    const recorded = checked(await db.from('travaux_payments').select('id').eq('id', profile.first_payment_id).maybeSingle());
    if (recorded && !checked(await db.rpc('travaux_paid', { p_user: userId, p_test: travauxTestMode() }))) {
      profile = await resetCheckout();
    }
  }
  if (profile.subscription_id) throw new TravauxError('Un abonnement existe déjà pour ce compte.', 409);
  if (profile.billing_plan && profile.billing_plan !== plan) {
    const previous = profile.first_payment_id ? await mollieRequest('payments/' + profile.first_payment_id) : null;
    if (previous && ['expired', 'canceled', 'failed'].includes(previous.status)) profile = await resetCheckout();
    else throw new TravauxError('Reprenez la formule du paiement déjà commencé.', 409);
  }

  const savedProfile = checked(await db.from('travaux_providers').update({
    email, name, phone, details, billing_plan: plan, terms_version: termsVersion, terms_accepted_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('checkout_key', profile.checkout_key).or('billing_plan.is.null,billing_plan.eq.' + plan).is('subscription_id', null).select('user_id').maybeSingle());
  if (!savedProfile) throw new TravauxError('Un abonnement existe déjà pour ce compte.', 409);

  let customerId = profile.customer_id;
  if (!customerId) {
    const customer = await molliePost('customers', 'travaux-customer-' + userId, {
      name, email, metadata: { product, userId },
    });
    customerId = customer.id;
    checked(await db.from('travaux_providers').update({ customer_id: customerId }).eq('user_id', userId).is('customer_id', null));
    const saved = checked(await db.from('travaux_providers').select('customer_id').eq('user_id', userId).single());
    customerId = saved.customer_id;
  }

  const paymentPath = 'customers/' + customerId + '/payments';
  let key = profile.checkout_key;
  let payment = profile.first_payment_id
    ? await mollieRequest('payments/' + profile.first_payment_id)
    : (await mollieRequest(paymentPath + '?limit=50'))._embedded?.payments?.find(
        (item: { metadata?: { checkoutKey?: string } }) => item.metadata?.checkoutKey === key);
  const checkoutConfiguration = async () => ({
    method: await frenchCheckoutMethods(plan),
    billingAddress: { streetAndNumber: details.address, postalCode: details.postcode, city: details.city, country: 'FR' },
    metadata: { product, userId, checkoutKey: key, plan, checkoutMarket: 'FR' },
    locale: 'fr_FR',
  });
  if (payment?.status === 'open' && payment.metadata?.checkoutMarket !== 'FR') {
    const path = 'payments/' + payment.id;
    const configuration = await checkoutConfiguration();
    try {
      payment = await mollieRequest(path, { method: 'PATCH', body: JSON.stringify(configuration) });
    } catch {
      payment = await mollieRequest(path);
      if (payment.status === 'open' && payment.metadata?.checkoutMarket !== 'FR') {
        if (!payment.isCancelable) throw new TravauxError('Le paiement précédent est encore ouvert. Réessayez dans quelques instants.', 409);
        try {
          payment = await mollieRequest(path, { method: 'DELETE' });
        } catch {
          payment = await mollieRequest(path);
          if (payment.status === 'open') throw new TravauxError('Le paiement précédent est encore ouvert. Réessayez dans quelques instants.', 409);
        }
      }
    }
  }
  if (payment && ['expired', 'canceled', 'failed'].includes(payment.status)) {
    const updated = checked(await db.from('travaux_providers').update({
      checkout_key: crypto.randomUUID(), first_payment_id: null,
    }).eq('user_id', userId).eq('checkout_key', key).select('checkout_key').single());
    key = updated.checkout_key;
    payment = null;
  }
  if (!payment) {
    payment = await molliePost('payments', 'travaux-checkout-' + key, {
      amount, description, customerId, sequenceType: plan === 'monthly' ? 'first' : 'oneoff',
      ...await checkoutConfiguration(),
      redirectUrl: origin + travauxPath + '?paiement=retour&lang=' + locale,
      webhookUrl: origin + '/api/travaux/mollie',
    });
  }
  const savedPayment = checked(await db.from('travaux_providers').update({ first_payment_id: payment.id })
    .eq('user_id', userId).eq('checkout_key', key).select('first_payment_id').single());
  if (savedPayment.first_payment_id !== payment.id) throw Error('Travaux payment was not recorded');
  if (payment.status === 'paid') {
    await reconcileTravauxPayment(db, payment.id, origin);
    return { ok: true };
  }
  if (payment.status === 'open' && isPaymentCheckoutUrl(payment._links?.checkout?.href)) {
    return { checkoutUrl: payment._links.checkout.href as string };
  }
  throw new TravauxError('Votre paiement est en cours de traitement.', 409);
}

export async function reconcileTravauxPayment(db: TravauxDb, id: string, origin: string) {
  const observed = new Date().toISOString();
  const payment = await mollieRequest('payments/' + id);
  if (!/^cst_[A-Za-z0-9]+$/.test(payment.customerId ?? '')) return;
  const profile = checked(await db.from('travaux_providers').select('*').eq('customer_id', payment.customerId).maybeSingle());
  if (!profile || profile.test_mode !== travauxTestMode() || payment.mode !== (profile.test_mode ? 'test' : 'live')) return;
  const plan: TravauxPlan = payment.metadata?.plan === 'annual' ? 'annual' : 'monthly';
  const amount = amountFor(plan);
  if (payment.amount?.currency !== amount.currency || payment.amount?.value !== amount.value) return;

  const first = payment.sequenceType === (plan === 'annual' ? 'oneoff' : 'first');
  if (first) {
    if (payment.metadata?.product !== product || payment.metadata?.userId !== profile.user_id) return;
    if (payment.metadata?.checkoutKey !== profile.checkout_key || (profile.first_payment_id && profile.first_payment_id !== id)) {
      const previous = plan === 'annual' && checked(await db.from('travaux_payments').select('id')
        .eq('id', id).eq('provider_id', profile.user_id).maybeSingle());
      if (!previous) return;
    } else if ((profile.billing_plan ?? 'monthly') !== plan) return;
  } else if (plan !== 'monthly' || payment.sequenceType !== 'recurring' || !['directdebit', 'creditcard'].includes(payment.method)
    || !profile.subscription_id || payment.subscriptionId !== profile.subscription_id) return;

  const disputed = Number(payment.amountRefunded?.value ?? 0) > 0 || Number(payment.amountChargedBack?.value ?? 0) > 0;
  if (payment.status !== 'paid' && !disputed) return;
  const day = parisDay(new Date(first ? payment.paidAt ?? payment.createdAt : payment.createdAt));
  if (plan === 'monthly' && first && !profile.subscription_id && !disputed) {
    if (!/^mdt_[A-Za-z0-9]+$/.test(payment.mandateId ?? '')) throw Error('Missing Travaux mandate');
    const base = 'customers/' + profile.customer_id;
    const mandate = await mollieRequest(base + '/mandates/' + payment.mandateId);
    const method = payment.method === 'creditcard' ? 'creditcard' : 'directdebit';
    if (mandate.status !== 'valid' || mandate.method !== method) throw Error('Travaux mandate is not valid yet');
    const path = base + '/subscriptions';
    const known = (await mollieRequest(path + '?limit=50'))._embedded?.subscriptions?.find(
      (item: { metadata?: { firstPayment?: string } }) => item.metadata?.firstPayment === id);
    const startDate = [monthBoundary(day, 1), parisDay(new Date())].sort()[1];
    const subscription = known ?? await molliePost(path, 'travaux-subscription-' + id, {
      amount, description, startDate, interval: '1 month', method, mandateId: payment.mandateId,
      metadata: { product, firstPayment: id }, webhookUrl: origin + '/api/travaux/mollie',
    });
    checked(await db.from('travaux_providers').update({ subscription_id: subscription.id, first_payment_id: id })
      .eq('user_id', profile.user_id).eq('checkout_key', profile.checkout_key).is('subscription_id', null));
  }
  const invoice = disputed ? null : (await loadAdvertisingInvoiceProfile(db)).profile;
  if (!disputed && !invoice) throw Error('Missing Travaux invoice configuration');
  checked(await db.rpc('travaux_settle_payment', {
    p_id: id, p_user: profile.user_id, p_day: day, p_plan: plan, p_paid: !disputed, p_observed: observed, p_profile: invoice,
  }));
  if (first && disputed && profile.subscription_id && !profile.cancelled_at) {
    await cancelTravauxSubscription(db, profile.user_id);
  }
}

export async function cancelTravauxSubscription(db: TravauxDb, userId: string, withNotice = false) {
  const profile = checked(await db.from('travaux_providers').select('*').eq('user_id', userId).maybeSingle());
  if (!profile?.subscription_id || profile.test_mode !== travauxTestMode()) {
    throw new TravauxError('Aucun abonnement à résilier.', 409);
  }
  if (profile.cancelled_at) return;
  const cancelledAt = new Date();
  const path = 'customers/' + profile.customer_id + '/subscriptions/' + profile.subscription_id;
  const subscription = await mollieRequest(path);
  if (!['canceled', 'completed'].includes(subscription.status)) {
    await mollieRequest(path, { method: 'DELETE' });
  }
  checked(await db.from('travaux_providers').update({
    cancelled_at: cancelledAt.toISOString(),
    notice_ends_on: withNotice ? monthBoundary(parisDay(cancelledAt), 1) : null,
  }).eq('user_id', userId).eq('subscription_id', profile.subscription_id).is('cancelled_at', null));
}
