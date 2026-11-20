# Features

Piecebook is a profile-based social portfolio and marketplace demo. The main
features are backed by Supabase data; the repository does not ship a user
authentication system.

## Profiles

- Select a public persona in the current browser.
- Edit supported profile fields and upload a profile image.
- A new schema installation includes one neutral demo profile.

The selected profile ID is a client-side persona identifier, not proof of
identity or account ownership.

## Posts and comments

- Create, edit, and remove posts.
- Add comments and supported image attachments.
- Like posts and browse post discussions.
- Form values and uploaded image constraints are validated with shared Zod
  schemas.

## Marketplace

- Browse listings and create, edit, or remove supported listings.
- Like listings and comment on them, including supported image attachments.
- Submit checkout requests; the server validates requests and stores order
  data.
- Checkout notifications can be sent by Gmail SMTP when configured.

## Messaging

- Browse conversations, send and edit messages, and attach supported files.
- Use realtime updates, message reactions, and conversation controls supported
  by the current schema.
- Validate message contents and attachment metadata.

## Interface and resilience

- Responsive layouts and consistent shared UI primitives
- Loading, empty, and error states across data-backed features
- Shared application error UI with a retry action
- Accessible labels and controls and long-text wrapping in key content views

## API and security boundaries

Persistent application operations use validated Next.js REST handlers under
`/api/v1`: profiles, posts, post comments, image uploads, marketplace listings,
listing engagement and comments, marketplace messages and reactions, orders,
messages, conversations, and message attachments. `POST
/api/marketplace/checkout` handles checkout and returns order/notification
results. Request errors use consistent JSON error bodies and explicit HTTP
status codes.

Supabase Realtime remains a direct client subscription transport so existing
live updates continue to work; it is not a CRUD endpoint.

The demo has no Supabase Auth identity checks. Database policies permit public
access for the anon role, and a client can select or spoof a persona ID. Do not
use it to store private data or represent that it enforces production
ownership, authorization, or user isolation.
