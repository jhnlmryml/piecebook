# Stripe Connect setup

Piecebook uses Stripe Accounts v2 with the Express dashboard, Stripe-hosted
Checkout, and direct charges with a 10% application fee. The item price and fee
are read and calculated server-side. The seller receives the item total minus
the application fee. The Express configuration assigns Stripe processing fees
to the platform, so actual platform margin is reduced by those processing fees.
Stripe requires an Express configuration to assign payment-fee and negative-
balance responsibility to the platform; see its [Accounts v2 configuration
guide](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration).

## Supabase migration

For an existing database, apply [`supabase-stripe-connect-migration.sql`](./supabase-stripe-connect-migration.sql)
in the Supabase SQL Editor. It is additive: existing orders are tagged as
`legacy`, and the new Stripe account, private payment, and webhook event tables
are added without deleting marketplace rows. Listings without a contact email
are backfilled from the seller email already stored in `public.users`. New
listings use that profile email if no contact email is entered. The same SQL block is appended to
[`supabase-schema.sql`](./supabase-schema.sql) for new database setup.

Stripe account IDs, buyer and seller emails, Checkout Session IDs, PaymentIntent
IDs, fees, and seller net amounts are stored in `marketplace_order_payments`.
That table has RLS enabled and no anon/authenticated grants. Public order
history is served through buyer- or seller-scoped server routes. Direct anon
and authenticated reads from `marketplace_orders` are revoked by the migration;
the public sold-item view returns only the item snapshot, without buyer data.

## Environment variables

Set these values locally in `.env.local` and in Vercel. Use Stripe test-mode
credentials until the full flow has been verified.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Existing browser key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for payments | Server-only key used for private payment records and webhook updates |
| `STRIPE_SECRET_KEY` | Yes for payments | Stripe test key (`sk_test_...`) during development |
| `STRIPE_WEBHOOK_SECRET` | Yes for webhooks | Signing secret for the webhook endpoint, typically `whsec_...` |
| `NEXT_PUBLIC_APP_URL` | Yes for Stripe | Site origin, for example `http://localhost:3000` locally and `https://piecebook.example` in production |
| `STRIPE_CONNECT_ACCOUNT_COUNTRY` | Optional | Two-letter account country supported by your Stripe platform; defaults to `US` |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional | Send buyer and seller order emails after confirmed payment |

Do not commit `.env.local`, put server keys in `NEXT_PUBLIC_*` variables, or
reuse a live Stripe secret for local testing. Hosted Checkout does not need a
Stripe publishable key in the browser.

If Connect onboarding returns `account_creation_losses_collector_unavailable`,
Stripe has not enabled the platform to accept Express account loss liability.
Complete the test-mode platform profile/activation in Stripe Dashboard, then
retry. Express accounts require the platform to own fee and loss
responsibilities in [Accounts v2](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration).

## Stripe dashboard webhook

After deployment, add a webhook endpoint in Stripe Workbench/Webhooks:

```text
https://<your-production-domain>/api/stripe/webhook
```

Enable events from connected accounts and subscribe to:

- `account.updated`
- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
For local testing, forward connected-account events to the webhook route:

```sh
stripe listen --events account.updated,checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --events-from @accounts --forward-connect-to http://localhost:3000/api/stripe/webhook
```

Leave off `--latest` to use the sandbox account's default event API version.
Set local `STRIPE_WEBHOOK_SECRET` to the signing secret printed by this active
listener, then restart the Next.js server. The endpoint validates the raw
request body signature. Valid sandbox events that do not match a Piecebook
order are acknowledged and ignored.

## Test flow

1. Apply the migration and set the Supabase and Stripe test environment values.
2. In Stripe test mode, finish the Connect platform profile and activation steps
   in the Stripe Dashboard. Account creation can fail until Stripe enables the
   platform to take the Express account responsibilities.
3. Start the app and select the seller profile.
4. Open **Seller Dashboard** and choose **Connect with Stripe**. Complete
   Stripe's test Express onboarding. Listing creation and publishing unlock
   only after the server confirms details are submitted, charges are enabled,
   and payouts are enabled.
5. Create a listing, then open an available listing from a different profile
   and choose **Buy now**. Complete Checkout with Stripe's test card
   `4242 4242 4242 4242`, any future expiry date, and any CVC.
6. Confirm that the return page stays pending until the webhook arrives, then
   shows the order as paid. Confirm the listing stock/status and order history
   update only after that webhook.
7. Start another Checkout and cancel it. The cancel return expires the Stripe
   session and releases the listing; expired sessions also release after the
   30-minute Checkout timeout.
8. Replay a webhook event from Stripe Workbench/CLI and confirm that no second
   order or stock decrement occurs.

This checkout charges USD because the existing marketplace UI displays USD.
The application fee is 10% of the server-read item total, rounded to cents.

## Vercel deployment

1. Apply `supabase-stripe-connect-migration.sql` to the production Supabase
   project.
2. Add the environment variables above in Vercel for the matching Production,
   Preview, or Development environment. Set `NEXT_PUBLIC_APP_URL` to that
   environment's public site origin and use Stripe test keys for previews.
3. Deploy the app, then register the deployed `/api/stripe/webhook` URL in
   Stripe and set the returned `STRIPE_WEBHOOK_SECRET` in Vercel.
4. Redeploy after setting the webhook secret, then complete the test flow above.
5. Before enabling live payments, replace Stripe test credentials with approved
   live credentials and register a live-mode webhook endpoint.

## Marketplace identity limitation

This repository uses browser-selectable public profile personas and does not
use Supabase Auth. The integration derives seller email and Stripe account IDs
from server-side listing/account records, and keeps financial records private,
but the selected profile ID is still client-controlled. It cannot prove that
the browser user owns a seller profile or buyer profile. Add Supabase Auth and
ownership-based RLS/API checks before using this demo with real users or live
payments. The existing README and `AGENTS.md` already describe this demo-only
security boundary.
