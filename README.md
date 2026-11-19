# Piecebook

Piecebook is a personal social wall project inspired by the classic Facebook Wall. It explores a familiar social feed experience with responsive layouts, image uploads, live updates, and profiles loaded from Supabase.

The interface is designed as a focused, full-height app: navigation stays in place while the wall content scrolls. On larger screens, the home page also showcases previews of my other projects.

## Project highlights

- Browse the wall, search posts, like posts, and publish text or image posts.
- Drag and drop photos into the composer or choose them with the file picker.
- View profiles and their posts, or browse the profiles directory.
- Edit your profile details and upload a profile photo.
- Receive wall changes through Supabase Realtime.
- Delete posts with confirmation and remove their associated images from Supabase Storage.
- Switch between Light, Dark, and Device themes with a single button.
- View previews and project details for my other work in the desktop sidebar.

The composer allows up to 280 characters and five images per post. Each image must be 5 MB or smaller and use an image format supported by the browser.

## Technology

- **Framework:** Next.js App Router, React, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui, shared CSS theme tokens
- **Data and media:** Supabase Postgres, Storage, and Realtime
- **Theme:** `next-themes`
- **UI details:** Base UI primitives, Lucide icons, Sonner notifications

## How the app is organized

Routes in `app/` stay small and compose the relevant page-level feature. The root layout sets up the theme, Supabase profile context, shared tooltip behavior, and notifications.

```text
app/                         Routes, root layout, global styles
components/
  features/
    friends/                 Friends directory
    posts/                   Post composer and live wall feed
    profile/                 Profile card and profile page
  layout/                    App header and home page composition
  shared/                    Loading placeholders
  theme/                     Theme provider and theme control
  ui/                        Reusable interface primitives
context/ProfileContext.tsx   Supabase profile data and selected persona state
lib/user-profiles.ts         Supabase profile query and normalization
data/portfolio-works.ts      Projects shown in the home sidebar
lib/posts.ts                 Post queries and mutations
lib/supabase.ts              Supabase browser client
types/                       Database and application types
public/images/               Static image assets
```

### Main routes

| Route | Experience |
| --- | --- |
| `/` | Wall, post composer, search, and project showcase |
| `/profile` | Selected profile and its posts |
| `/profile/[userId]` | Another profile and its posts |
| `/friends` | Profile directory |

## Data and interaction model

Profiles are loaded from `public.users`. The profile named Monkey D. Luffy is selected on a fresh browser visit; the last selected profile is saved locally. Switching profiles saves the selected `public.users.id` and reloads the app. This is a profile persona switcher, not Supabase Auth.

The app uses `public.posts`. The existing `public.post` table remains in the database but is unused; `supabase-schema.sql` copies its legacy rows into `public.posts` without dropping or renaming it. Posts, comments, likes, marketplace activity, and profile edits identify the selected persona with its `public.users.id`. `WallFeed` loads the newest 50 posts and handles likes and deletion. Comments are stored in `public.post_comments`; each comment can include text, an image, or both. Post and comment images are saved in the `post-images` Storage bucket; profile photos use `profile-images`.

Marketplace listings are loaded from `public.marketplace_listing`; listing photos are uploaded to the `marketplace-listing-images` Storage bucket. Listing likes and comments are stored in `public.marketplace_listing_likes` and `public.marketplace_listing_comments`; listing comments support image attachments. Seller messages are inserted into the general `public.message` table, and emoji reactions are stored in `public.message_reactions`. Run `supabase-schema.sql` in the Supabase SQL Editor before using these features. The marketplace starts empty until listings are created in Supabase.

Supabase stores profiles, shared posts, comments, marketplace listings, messages, and uploaded media. Apply `supabase-schema.sql` in the Supabase SQL Editor to remove the old `owner_id` columns, configure the profile-based policies and image buckets, and add the realtime tables. The app keeps one Realtime channel for the selected profile's live wall and marketplace engagement updates. Marketplace listing row changes are intentionally excluded from that channel.

The profile switcher is only a demo identity selector. Anyone with the app's public Supabase key can choose any profile, and the schema allows public reads and writes so the app works without an Auth session. Do not store private user data or use this setup for a production app that needs account ownership.

## Implementation notes

- The home and profile screens use a contained, full-height layout so the feed can scroll independently of the header.
- Theme selection uses a single control that cycles through Light, Dark, and Device modes.
- Shared design tokens and reusable Tailwind component classes keep the light and dark palettes consistent.
- Post image checks limit size, type, and count in the interface; trusted server and storage policies are still needed for production enforcement.
- The portfolio previews use external iframes. A site can prevent embedding, so each preview also links to the project itself.

## Code quality

Run the project's combined static and production-build checks with:

```bash
npm run check
```

This runs ESLint, TypeScript, and the Next.js production build. The repository does not currently include an automated browser or unit test suite.
