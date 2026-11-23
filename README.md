# Piecebook

Piecebook is a profile-based social portfolio and marketplace demo built with
Next.js, React, TypeScript, Supabase, and Zod. It includes posts, comments,
profiles, realtime messaging, and marketplace listings and checkout.

> **Demo-only security model:** profiles are selectable public personas, not
> authenticated accounts. The Supabase anon key can read and write data under
> permissive RLS policies. Do not use this deployment or its database for
> private or production user data.

## Documentation

- [Setup](./SETUP.md) — local development and Supabase configuration
- [Features](./FEATURES.md) — implemented features and current boundaries
- [Development guide](./DEVELOPMENT_GUIDE.md) — project patterns and checks
- [Stripe Connect setup](./STRIPE_CONNECT_SETUP.md) — seller onboarding, test Checkout, webhook, and Vercel configuration

## Quick start

1. Install Node.js and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and
   anon key. Add the server-only Supabase service-role key and Stripe test keys
   to enable Connect payouts and Checkout.
4. Apply the single canonical database file, [`supabase-schema.sql`](./supabase-schema.sql),
   using the Supabase SQL Editor.
5. Start the app with `npm run dev`, then open `http://localhost:3000`.

The schema creates a neutral demo profile so a new demo database can be opened
without importing example user data. Back up existing databases before applying
the schema; see [SETUP.md](./SETUP.md).

## Main functionality

- Profile selection and editable profile details
- Social posts, comments, likes, and image attachments
- Marketplace listings, listing comments and likes, and checkout requests
- Realtime inbox, message attachments, and conversation controls
- Responsive layouts, loading and empty states, inline validation, and an
  application-level error page

All form input is validated with shared Zod schemas. Profiles, posts, comments,
marketplace data and engagement, orders, messages, conversations, and uploads
use typed Next.js REST handlers under `/api/v1`. Marketplace checkout uses
Stripe-hosted Checkout at `POST /api/marketplace/checkout`, with Connect
onboarding and webhooks under `/api/stripe`. Supabase Realtime remains the
client's subscription transport. These APIs preserve the public demo persona
model and do not establish authenticated user ownership.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key used by the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe flows | Server-only Supabase access for private payment records |
| `STRIPE_SECRET_KEY` | Stripe flows | Stripe test/live secret key; never expose to the browser |
| `STRIPE_WEBHOOK_SECRET` | Stripe flows | Signing secret for `/api/stripe/webhook` |
| `NEXT_PUBLIC_APP_URL` | Stripe flows | Public site origin used for Checkout and Connect return URLs |
| `STRIPE_CONNECT_ACCOUNT_COUNTRY` | Optional | Two-letter seller account country; defaults to `US` |
| `GMAIL_USER` | Optional | Gmail account used for paid-order notifications |
| `GMAIL_APP_PASSWORD` | Optional | Gmail app password for SMTP |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry project DSN for browser and server error monitoring |
| `SENTRY_ORG` | Optional | Sentry organization slug for source map uploads during builds |
| `SENTRY_PROJECT` | Optional | Sentry project slug for source map uploads during builds |
| `SENTRY_AUTH_TOKEN` | Optional | Build token for uploading source maps; keep server-only |

Stripe Checkout collects the buyer email and sends order notifications after
the verified webhook finalizes payment. Sellers must have an email on their
marketplace listing before connecting payouts.
Never put a Supabase service-role key or other server secret in a `NEXT_PUBLIC_`
variable. The example environment file contains placeholders only.
To enable Sentry, create a Sentry project and set its DSN as
`NEXT_PUBLIC_SENTRY_DSN`. Source map uploads are enabled when all three
`SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` values are configured.

## Useful commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
```

See `package.json` for the authoritative script list.
