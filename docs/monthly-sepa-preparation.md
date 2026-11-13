# Monthly advertising billing — SEPA and credit card

Decision recorded 13 November 2026: a rolling monthly subscription, cancellable each month. Rikus also explicitly requested recurring credit-card payments alongside SEPA.

## Behavior

- Existing one-off orders retain their current checkout and agreed fixed period.
- New advertisements offer a monthly plan by default, or a one-off fixed-period payment.
- Prices remain €15 / €79 / €149 per month; combinations sum the existing server prices.
- Explicit unticked consent, terms version, locale, selected method and timestamp are recorded before checkout.
- Initial customer-authorised payment uses Mollie's `sequenceType: first`. SEPA setup offers only enabled bank methods which produce a directdebit mandate; a card choice explicitly uses creditcard.
- Customer and mandate references are server-side; raw card details and IBANs are not stored by this feature.
- Each month has a separate order, payment reference and invoice. The first payment pays the first month, without a duplicate debit for that period.
- Renewal uses Mollie's Payments API with `sequenceType: recurring`, the verified mandate and stable per-cycle idempotency key. Scheduling is performed by the application's existing authenticated daily listing-mail job, not by a separate Mollie Subscription resource.
- Calendar boundaries are derived from the original anchor, so 31 January → 28 February → 31 March.
- Cancellation prevents initiation of further planned charges; existing paid visibility remains until its agreed end. Already initiated payments may still be processed. The customer sees this before consent and cancellation.
- Failed/reversed payments pause renewal and queue an email; no unlimited automatic retry or deletion of the free listing.
- Ongoing contracts reserve placement capacity without granting unlimited unpaid public visibility.

## Routes and jobs

- `/api/managed-event/advertising`: verified personal management token, server quote and explicit monthly consent.
- `/api/mollie/recurring/checkout`: first-payment setup with saved contract and safe checkout URL.
- `/api/mollie/recurring/webhook`: fetches payment from Mollie, validates mode, customer, cycle, amount, method and sequence before applying state.
- `/api/managed-event/subscription`: owner-scoped refresh/cancel.
- Existing checkout and status endpoints detect monthly orders and dispatch to the recurring logic.
- Existing `/api/cron/listing-mail` authenticates `CRON_SECRET`, handles upcoming billing, recurring payments, notices and invoices. It runs daily at the existing schedule. Charge dates are calendar dates, not an exact hour.
- Customer management shows subscription method, amount, payment status and cancellation. Administration exposes subscription status next to the matching invoice/order.

## Operational details

- Tables are RLS enabled, service-only; no anon/authenticated table grants or billing RPC execution.
- Test mode cannot reconcile a live payment or consume production placement capacity. Test/preview mail routes to the configured own mailbox.
- A database lease and stable idempotency key prevent concurrent duplicate charges. An ambiguous creation older than 20 hours requires manual review rather than repeating a possibly successful charge beyond the idempotency window.
- The daily worker reconciles open payments, retries missing invoice work, reserves the following period and sends upcoming-payment notices before allowing a renewal charge.
- The worker does not initiate renewal without an accepted upcoming-payment email.
- Missing email or invoice configuration blocks new subscription checkout with an actionable message.
- A terminal first-payment failure currently requires cancelling that pending contract and starting a new request; do not reuse an uncertain payment reference.
- A past-due subscription requires owner/support attention and a fresh authorisation when needed. It does not silently switch to another payment method.

## Verification

- Pure payment verification tests cover SEPA/card, initial/recurring sequence, incorrect identity, incorrect amount, mode mismatch, pending, refunds and chargebacks.
- PGlite runs the actual migrations and tests contract idempotency, duplicate callbacks, one invoice per period, month-end handling, cancellation and service-only access.
- Existing checkout/status, calendar capacity and municipal-advertising regression tests are run alongside the new tests.
- Production build and TypeScript checks are required before publication.
- Verify the real Mollie test checkout, enabled bank/card methods, mail configuration, cron execution and public deployment before treating this feature as live.

## Official references

- https://docs.mollie.com/docs/recurring-payments
- https://docs.mollie.com/reference/create-payment
- https://docs.mollie.com/reference/create-mandate
- https://docs.mollie.com/docs/sepa-direct-debit

## Deployment checkpoint — 13 November 2026

Draft PR #4 contains the implementation; main/production remains unchanged pending completion of SEPA provider tests. Both active projects are in the Domaine Le Nourrissat Pro organization; the separate historical Database 47 test project (evvanbexkkdaqdfoginp) remains Free. Its preview credentials were retained, preserving separation from production.

Both monthly migrations are now installed in that test database through the authenticated dashboard. Readiness endpoint reports databaseReady/configured true. RLS is enabled and anon cannot select any of the three new tables. Migration versions are recorded.

Real Mollie test-mode credit-card checkout completed through hosted checkout with the official test card. Verified: paid state; valid mandate; one automatic monthly invoice; confirmation and invoice outbox accepted; next month planned; owner cancellation preserves paid_until and cancels the planned cycle. No real charge was performed.

SEPA test checkout reports no enabled first-payment bank method that creates a directdebit mandate. Mollie dashboard currently requires sign-in. Inspect the intended profile and enabled SEPA/Pay by Bank methods before declaring SEPA ready. No bank method was activated, no account/plan changed and no credentials copied. The owner request endpoint now checks provider, mail and invoice readiness before reserving a new monthly order.

Browser review also found and fixed untranslated payment-confirmation text and the manual payment button on automatic renewal cycles. Verify those changes in the latest preview before release.
