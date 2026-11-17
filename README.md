# Piecebook

Piecebook is a personal social wall project inspired by the classic Facebook Wall. I built it to explore a familiar social feed experience with responsive layouts, image uploads, live updates, and a small collection of sample profiles.

The interface is designed as a focused, full-height app: navigation stays in place while the wall content scrolls. On larger screens, the home page also showcases previews of my other projects.

## Project highlights

- Browse the wall, search posts, like posts, and publish text or image posts.
- Drag and drop photos into the composer or choose them with the file picker.
- View each sample profile and that profile's posts, or browse the friends directory.
- Receive wall changes through Supabase Realtime.
- Delete posts with confirmation and remove their associated images from Supabase Storage.
- Switch between Light, Dark, and Device themes with a single button.
- View previews and project details for my other work in the desktop sidebar.

The composer allows up to 280 characters and five images per post. Each image must be 5 MB or smaller and use JPEG, PNG, GIF, WebP, or AVIF format.

## Technology

- **Framework:** Next.js App Router, React, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui, shared CSS theme tokens
- **Data and media:** Supabase Postgres, Storage, and Realtime
- **Theme:** `next-themes`
- **UI details:** Base UI primitives, Lucide icons, Sonner notifications

## How the app is organized

Routes in `app/` stay small and compose the relevant page-level feature. The root layout sets up the theme, demo profile context, shared tooltip behavior, and notifications.

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
context/AuthContext.tsx      Selected sample profile state
data/demo-users.ts           Sample profiles and profile details
data/portfolio-works.ts      Projects shown in the home sidebar
lib/posts.ts                 Post queries and mutations
lib/supabase.ts              Supabase browser client
types/                       Database and application types
public/images/               Sample profile photos
```

### Main routes

| Route | Experience |
| --- | --- |
| `/` | Wall, post composer, search, and project showcase |
| `/profile` | Selected sample profile and its posts |
| `/profile/[userId]` | Another sample profile and its posts |
| `/friends` | Sample profile directory |

## Data and interaction model

The sample profiles live in `data/demo-users.ts`. The selected profile is saved in browser session storage so the profile switcher can demonstrate different authorship and feed views without a sign-in flow.

Posts are stored in Supabase's `public.post` table. `WallFeed` loads the newest 50 posts, filters them, handles likes and deletion, and subscribes to Postgres changes while keeping the displayed feed capped at 50. The composer uploads image files to the `post-images` Storage bucket, then saves their public URLs with the post. Post deletion removes matching owned image objects before deleting the row.

The profile and friend data are local demo content; Supabase is used for the shared wall posts and uploaded media. The current profile switcher is not authentication. Anonymous database and storage policies are suitable only for a demo and must be replaced with authenticated, user-scoped policies before this pattern is used for a public social app.

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
