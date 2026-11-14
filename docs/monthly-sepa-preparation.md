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

## French advertisers and confirmed Mollie organization

Rikus confirmed organization #19136437 (Le Nourrissat) on 13 November. French advertiser billing defaults to France and French locale; the existing SEPA first-payment list includes Pay by Bank (France-supported) and MyBank as documented. Do not treat iDEAL alone as French bank coverage. Card and SEPA methods remain separate mandates.

Read-only preview readiness now confirms the currently stored test key resolves to profile pfl_JCS8Crrwgd, with only creditcard returned for both first and recurring methods. Organization #19136437 shows website profiles pfl_NAma7doDmX (Le Nourrissat, cotededuras.com; some attention required) and pfl_yBVU4Cdgmo (Le Nourrissat #66551, cotededuras.com; online). The existing live key named Cote de Duras was created 5 November and belongs to pfl_NAma7doDmX. No API secret was revealed.

A matching standard Test API-key form for Le Nourrissat in #19136437 and the existing branch-scoped Vercel Preview MOLLIE_API_KEY edit field are prepared in the user's local browser. No key was created, rotated, copied, or saved. User must complete secure credential creation/entry.

Pay by Bank is offered for activation but not enabled. The dashboard explicitly states that activation accepts additional payment-method terms, so obtain explicit action-time confirmation before activating it. French public standard pricing currently lists 0.45% + EUR0.25 for Pay by Bank; dashboard/account terms control actual charges.

Invoice seller identity needs confirmation before release: selected Mollie organization shows registration number 98402615300010, whereas the existing invoice seller constant uses 93451899400025. Do not silently rewrite historical invoices or change a legal identifier without resolving this mismatch with Rikus.

## Authorization and Pay by Bank request — 13 November 2026

Rikus explicitly authorized Pay by Bank activation and accepted its additional terms; he confirmed 93451899400025 is the correct invoice SIRET. Preserve that existing seller constant; the prior invoice-identity confirmation blocker is resolved by the owner's instruction. Do not alter historic invoices or the Mollie registration without separate instructions.

Pay by Bank activation was submitted for profile pfl_NAma7doDmX in organization #19136437. Mollie's confirmation dialog now states that the payment-method request is still being reviewed and that an email will follow when processed. It is requested/pending review, not yet confirmed live. The dialog displays EUR0.25 + 0.45% per transaction and EUR0.25 per refund; France is in its supported-country list. No second profile or unrelated method was changed.

Remaining blocker for end-to-end French SEPA test: replace the mismatched existing Preview key securely with a Test key for the chosen profile. API-key creation form (standard, Test, Le Nourrissat) and branch-only Vercel MOLLIE_API_KEY edit field are ready in the user's local browser. No new key has been created or entered. Do not collect the key through chat. After secure entry, redeploy feature preview and check the sanitized readiness endpoint before further provider tests.

## Release verification — 14 November 2026

The owner completed secure entry of a Mollie Test key in Vercel. The monthly preview resolves to verified profile pfl_NAma7doDmX in organization #19136437. First-payment methods include ideal, creditcard and paybybank; recurring methods include creditcard and directdebit. Pay by Bank is now enabled. No API secret was copied into repository or chat.

Restored preview database settings by moving the retained historical feature/tourisme-duras-enrichment Preview service and publishable-key overrides to prepare/monthly-sepa-20261112. Production values were not changed. This retires database access for that older preview branch. Readiness confirms the separate test database evvanbexkkdaqdfoginp and configured/databaseReady true.

Hosted French Pay by Bank test checkout succeeded for a EUR15 SEPA monthly contract. The application verified the valid directdebit mandate, marked the first period paid through 14 December, generated exactly one test invoice and planned the next period. Confirmation and invoice outboxes were accepted by the mail server. Owner cancellation was verified through the UI: paid_until remains 14 December and the next planned payment is cancelled. No real charge was performed. An actual future scheduled renewal debit is not yet exercised; renewal state transitions and idempotency are covered by the SQL and payment-verification tests.

Merged current main into the feature branch, preserving recent social links, invoice-preserving archives and photo fallbacks. Local production build and TypeScript passed. 32 targeted tests passed across recurring payment validation, actual SQL transitions/security, existing Mollie checkout/status, archives and presentation. All 84 price/duration combinations also passed. Production billing tables/functions already exist and RLS remains enabled with no anon/authenticated SELECT grants.
