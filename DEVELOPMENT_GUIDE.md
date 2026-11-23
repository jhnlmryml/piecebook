# Development guide

## Project conventions

- Keep application code in TypeScript and follow nearby component and naming
  patterns.
- Reuse shared UI components from `components/ui` and feature components from
  `components/features`.
- Use `@/lib/utils` for class merging and share presentation components when
  the same UI appears across features; comment threads live in
  `components/features/comments`.
- Keep shared Zod form schemas in `lib/form-schemas.ts`; parse inputs at the
  form/data boundary and at server endpoints.
- Use the typed Supabase client and shared data helpers rather than duplicating
  table access logic.
- Show loading, empty, and error feedback for asynchronous interactions.
- Keep user-provided long text readable with responsive wrapping and bounded
  layout behavior.

## Data and API

The one canonical schema file is [`supabase-schema.sql`](./supabase-schema.sql).
Keep schema changes in that file and update the TypeScript table types and
data helpers when the database shape changes.
For an existing Supabase project, apply the targeted SQL migration included
with a schema change before relying on its database-side performance benefits.

REST requests are dispatched by
[`app/api/v1/[...path]/route.ts`](./app/api/v1/[...path]/route.ts) to
domain handlers in `lib/server/api`. The API covers profiles, posts and
comments, marketplace listings and engagement, orders, messaging, conversations,
and file uploads. Checkout remains at
[`app/api/marketplace/checkout/route.ts`](./app/api/marketplace/checkout/route.ts).
For new operations, validate request data with Zod, use explicit statuses and
bounded payloads, return typed resource data, and log server failures without
returning internal details. Keep live subscriptions on Supabase Realtime.

## Validation and tests

Run the existing checks before submitting changes:

```bash
npm run lint
npm run typecheck
npm run build
```

Or run all three using `npm run check`. Add focused tests for new behavior when
an existing test runner or appropriate test setup is available; do not infer
security from client-side validation.

## Production limitations

The current persona selection and public RLS policies are suitable only for a
non-private demo. Before using Piecebook with real users or sensitive data,
introduce Supabase Auth, derive identity from verified sessions, restrict
policies by authenticated identity, and review all file-storage and API
authorization rules. Do not treat the browser-selected profile ID as trusted.
