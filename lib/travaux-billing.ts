import { intlLocale, type Locale } from './i18n';
import { monthBoundary } from './recurring-billing';
import { billingOrigin } from './recurring-server';
import { mollieRequest } from './mollie';
import { isPaymentCheckoutUrl } from './payment-checkout-url';
import { travauxPath } from './travaux';
import { checked, TravauxError, travauxTestMode, type TravauxDb } from './travaux-server';

const amount = { value: '25.00', currency: 'EUR' };
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

function travauxBillingOrigin(request: Request) {
  const origin = billingOrigin(request);
  if (origin !== new URL(request.url).origin) {
    throw new TravauxError('Ouvrez la page depuis son adresse officielle pour procéder au paiement.', 403);
  }
  return origin;
}

export async function startTravauxCheckout(db: TravauxDb, request: Request, userId: string, email: string, name: string, phone: string, locale: Locale) {
  const origin = travauxBillingOrigin(request);
  checked(await db.from('travaux_providers').upsert({
    user_id: userId, email, name, phone, test_mode: travauxTestMode(),
  }, { onConflict: 'user_id', ignoreDuplicates: true }));
  const profile = checked(await db.from('travaux_providers').select('*').eq('user_id', userId).single());
  if (profile.test_mode !== travauxTestMode()) throw new TravauxError('Ce profil appartient à un autre environnement de paiement.', 409);
  if (profile.subscription_id) throw new TravauxError('Un abonnement existe déjà pour ce compte.', 409);

  let customerId = profile.customer_id;
  if (!customerId) {
    const customer = await molliePost('customers', 'travaux-customer-' + userId, {
      name: profile.name, email: profile.email, metadata: { product, userId },
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
  if (payment && ['expired', 'canceled', 'failed'].includes(payment.status)) {
    const updated = checked(await db.from('travaux_providers').update({
      checkout_key: crypto.randomUUID(), first_payment_id: null,
    }).eq('user_id', userId).eq('checkout_key', key).select('checkout_key').single());
    key = updated.checkout_key;
    payment = null;
  }
  if (!payment) {
    payment = await molliePost('payments', 'travaux-checkout-' + key, {
      amount, description, customerId, sequenceType: 'first',
      metadata: { product, userId, checkoutKey: key },
      locale: intlLocale[locale].replace('-', '_'),
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
  if (!profile || profile.test_mode !== travauxTestMode() || payment.mode !== (profile.test_mode ? 'test' : 'live')
    || payment.amount?.currency !== amount.currency || payment.amount?.value !== amount.value) return;

  const first = payment.sequenceType === 'first';
  if (first) {
    if (payment.metadata?.product !== product || payment.metadata?.userId !== profile.user_id
      || payment.metadata?.checkoutKey !== profile.checkout_key
      || (profile.first_payment_id && profile.first_payment_id !== id)) return;
  } else if (payment.sequenceType !== 'recurring' || !profile.subscription_id || payment.subscriptionId !== profile.subscription_id) {
    return;
  }

  const disputed = Number(payment.amountRefunded?.value ?? 0) > 0 || Number(payment.amountChargedBack?.value ?? 0) > 0;
  if (payment.status !== 'paid' && !disputed) return;
  const day = parisDay(new Date(first ? payment.paidAt ?? payment.createdAt : payment.createdAt));
  if (first && !profile.subscription_id && !disputed) {
    if (!/^mdt_[A-Za-z0-9]+$/.test(payment.mandateId ?? '')) throw Error('Missing Travaux mandate');
    const base = 'customers/' + profile.customer_id;
    const mandate = await mollieRequest(base + '/mandates/' + payment.mandateId);
    if (mandate.status !== 'valid') throw Error('Travaux mandate is not valid yet');
    const path = base + '/subscriptions';
    const known = (await mollieRequest(path + '?limit=50'))._embedded?.subscriptions?.find(
      (item: { metadata?: { firstPayment?: string } }) => item.metadata?.firstPayment === id);
    const startDate = [monthBoundary(day, 1), parisDay(new Date())].sort()[1];
    const subscription = known ?? await molliePost(path, 'travaux-subscription-' + id, {
      amount, description, startDate, interval: '1 month', mandateId: payment.mandateId,
      metadata: { product, firstPayment: id }, webhookUrl: origin + '/api/travaux/mollie',
    });
    checked(await db.from('travaux_providers').update({ subscription_id: subscription.id, first_payment_id: id })
      .eq('user_id', profile.user_id).eq('checkout_key', profile.checkout_key).is('subscription_id', null));
  }
  checked(await db.rpc('travaux_record_payment', {
    p_id: id, p_user: profile.user_id, p_day: day, p_paid: !disputed, p_observed: observed,
  }));
  if (first && disputed && profile.subscription_id && !profile.cancelled_at) {
    await cancelTravauxSubscription(db, profile.user_id);
  }
}

export async function cancelTravauxSubscription(db: TravauxDb, userId: string) {
  const profile = checked(await db.from('travaux_providers').select('*').eq('user_id', userId).maybeSingle());
  if (!profile?.subscription_id || profile.test_mode !== travauxTestMode()) {
    throw new TravauxError('Aucun abonnement à résilier.', 409);
  }
  if (profile.cancelled_at) return;
  const path = 'customers/' + profile.customer_id + '/subscriptions/' + profile.subscription_id;
  const subscription = await mollieRequest(path);
  if (!['canceled', 'completed'].includes(subscription.status)) {
    await mollieRequest(path, { method: 'DELETE' });
  }
  checked(await db.from('travaux_providers').update({ cancelled_at: new Date().toISOString() }).eq('user_id', userId));
}
