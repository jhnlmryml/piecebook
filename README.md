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

## Quick start

1. Install Node.js and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and
   anon key.
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
use typed Next.js REST handlers under `/api/v1`. Checkout is handled by
`POST /api/marketplace/checkout`. Supabase Realtime remains the client's
subscription transport. These APIs preserve the public demo persona model and
do not establish authenticated user ownership.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key used by the browser |
| `GMAIL_USER` | Optional | Gmail account used for checkout notifications |
| `GMAIL_APP_PASSWORD` | Optional | Gmail app password for SMTP |

The buyer can optionally enter an email at checkout. Sellers can optionally
enter their email when creating a listing. Notifications go only to those
provided addresses.
Never put a Supabase service-role key or other server secret in a `NEXT_PUBLIC_`
variable. The example environment file contains placeholders only.

## Useful commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
```

See `package.json` for the authoritative script list.
