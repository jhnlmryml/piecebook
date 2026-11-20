# Setup

## Requirements

- Node.js 20.9 or newer
- npm
- A Supabase project

## Install and configure

1. Install the project dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using
   your Supabase project's API settings.
4. Optionally configure Gmail SMTP and `MARKETPLACE_SELLER_EMAIL` for checkout
   notifications. Use a Gmail app password, not your account password.
5. Apply [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL
   Editor.
6. Run `npm run dev` and open `http://localhost:3000`.

The schema creates a neutral `Demo member` profile for a new demo database.
Marketplace data starts empty.

## Database setup and safety

[`supabase-schema.sql`](./supabase-schema.sql) is the only database
schema/migration source in this repository. It includes the tables, indexes,
functions, triggers, storage configuration, public policies, and additive
updates for the app's current data model.

Back up existing databases and try the script in a disposable/staging project
before applying it to any database with data. The script removes legacy
`owner_id` columns and replaces relevant policies. It is intentionally designed
for this app's public demo model; it does not establish private per-user access.

## Environment notes

- `NEXT_PUBLIC_` values are shipped to browsers. The Supabase anon key is not a
  service-role key and must not be treated as a private credential.
- Never add a Supabase service-role key to a `NEXT_PUBLIC_` variable or commit
  secrets to `.env.example`.
- Checkout creation does not require SMTP. Without Gmail settings, the order
  can still be created, but email notifications are not sent.
- Gmail notifications require `GMAIL_USER` and `GMAIL_APP_PASSWORD`.
  `MARKETPLACE_SELLER_EMAIL` sets the notification recipient for the seller.

## Common commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
```

`npm run check` runs lint, TypeScript checking, and the production build.
