-- Piecebook profile-based schema
-- This app uses public.users rows as selectable personas. It does not use
-- Supabase Auth. The selected profile id is a client-side identity only.
-- Applying this schema removes owner_id columns and replaces Auth-only RLS
-- policies with public policies so the anon key can read and write app data.
-- This is suitable for a demo app, not private or production user data.
-- Run in the Supabase SQL Editor. The statements are safe to rerun.

create extension if not exists pgcrypto;

-- Clear old Auth policies before removing their owner_id columns.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public' and tablename = any(array[
      'users', 'posts', 'post_comments', 'marketplace_listing',
      'marketplace_listing_likes', 'marketplace_listing_comments',
      'message', 'message_reactions', 'marketplace_message'
    ]))
      or (schemaname = 'storage' and tablename = 'objects' and (
        (coalesce(qual, '') || coalesce(with_check, '')) ilike '%post-images%'
        or (coalesce(qual, '') || coalesce(with_check, '')) ilike '%marketplace-listing-images%'
        or (coalesce(qual, '') || coalesce(with_check, '')) ilike '%profile-images%'
      ))
  loop
    execute format('drop policy %I on %I.%I', existing_policy.policyname,
      existing_policy.schemaname, existing_policy.tablename);
  end loop;
end
$$;

-- Remove Auth identity columns left by the earlier schema. Existing profile,
-- post, listing, comment, and message rows are retained.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'posts', 'post_comments', 'marketplace_listing',
    'marketplace_listing_likes', 'marketplace_listing_comments',
    'message', 'message_reactions', 'marketplace_message'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I drop column if exists owner_id cascade', table_name);
    end if;
  end loop;
end
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  role text,
  birthdate date,
  location text,
  interests text[],
  dream text,
  about text,
  image text[],
  created_at timestamptz not null default now()
);
alter table public.users add column if not exists email text;
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists role text;
alter table public.users add column if not exists birthdate date;
alter table public.users add column if not exists location text;
alter table public.users add column if not exists interests text[];
alter table public.users add column if not exists dream text;
alter table public.users add column if not exists about text;
alter table public.users add column if not exists image text;
alter table public.users add column if not exists created_at timestamptz not null default now();
-- Convert legacy free-text birthdays to date values. Unrecognized values are
-- cleared so one old free-form value cannot prevent the schema from applying.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'birthdate'
      and data_type <> 'date'
  ) then
    alter table public.users
      alter column birthdate type date
      using (
        case
          when nullif(btrim(birthdate::text), '') is null then null
          when btrim(birthdate::text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            then btrim(birthdate::text)::date
          when btrim(birthdate::text) ~* '^[A-Za-z]+ [0-9]{1,2}, [0-9]{4}$'
            then to_date(btrim(birthdate::text), 'FMMonth FMDD, YYYY')
          when btrim(birthdate::text) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
            then to_date(btrim(birthdate::text), 'FMMM/FMDD/YYYY')
          else null
        end
      );
  end if;
end
$$;
alter table public.users alter column email drop not null;
alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;
grant select, update on table public.users to anon, authenticated;
create policy "Profiles are publicly readable"
  on public.users for select to anon, authenticated using (true);
create policy "Profiles can be edited by the app"
  on public.users for update to anon, authenticated using (true) with check (true);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post text,
  image text[] default '{}',
  likes_by text[] default '{}',
  created_at timestamptz not null default now()
);
alter table public.posts add column if not exists post text;
alter table public.posts add column if not exists image text[] default '{}';
alter table public.posts add column if not exists likes_by text[] default '{}';
alter table public.posts add column if not exists created_at timestamptz not null default now();
alter table public.posts replica identity full;
create index if not exists posts_user_created_at_idx
  on public.posts (user_id, created_at desc);
alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select, insert, update, delete on table public.posts to anon, authenticated;
create policy "Posts are publicly readable"
  on public.posts for select to anon, authenticated using (true);
create policy "Profiles can publish posts"
  on public.posts for insert to anon, authenticated with check (true);
create policy "Posts can be updated by the app"
  on public.posts for update to anon, authenticated using (true) with check (true);
create policy "Posts can be deleted by the app"
  on public.posts for delete to anon, authenticated using (true);

-- Copy legacy wall posts without changing or removing public.post.
do $$
begin
  if to_regclass('public.post') is not null then
    insert into public.users (
      id, email, full_name, role, birthdate, location, interests,
      dream, about, image, created_at
    )
    select
      legacy.user_id,
      null,
      'Legacy member ' || left(legacy.user_id::text, 8),
      'Member',
      null,
      '',
      array[]::text[],
      '',
      '',
      '',
      min(legacy.created_at)
    from public.post as legacy
    left join public.users as profile on profile.id = legacy.user_id
    where profile.id is null and legacy.user_id is not null
    group by legacy.user_id
    on conflict (id) do nothing;

    insert into public.posts (id, user_id, post, image, likes_by, created_at)
    select id, user_id, post, image, likes_by, created_at
    from public.post
    on conflict (id) do nothing;
  end if;
end
$$;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null default '',
  image text[],
  created_at timestamptz not null default now(),
  constraint post_comments_body_or_image_check check (
    char_length(btrim(body)) <= 2000
    and coalesce(cardinality(image), 0) <= 5
    and (char_length(btrim(body)) > 0 or coalesce(cardinality(image), 0) > 0)
  )
);
alter table public.post_comments add column if not exists image text[];
alter table public.post_comments replica identity full;
alter table public.post_comments alter column body set default '';
alter table public.post_comments drop constraint if exists post_comments_body_check;
alter table public.post_comments drop constraint if exists post_comments_body_or_image_check;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_comments'
      and column_name = 'image'
      and udt_name = 'text'
  ) then
    alter table public.post_comments
      alter column image type text[]
      using case when image is null then null else array[image] end;
  end if;
end
$$;
alter table public.post_comments
  add constraint post_comments_body_or_image_check check (
    char_length(btrim(body)) <= 2000
    and coalesce(cardinality(image), 0) <= 5
    and (char_length(btrim(body)) > 0 or coalesce(cardinality(image), 0) > 0)
  );
create index if not exists post_comments_post_created_at_idx
  on public.post_comments (post_id, created_at asc);
alter table public.post_comments enable row level security;
revoke all on table public.post_comments from anon, authenticated;
grant select, insert, delete on table public.post_comments to anon, authenticated;
create policy "Post comments are publicly readable"
  on public.post_comments for select to anon, authenticated using (true);
create policy "Profiles can comment on posts"
  on public.post_comments for insert to anon, authenticated with check (true);
create policy "Post comments can be deleted by the app"
  on public.post_comments for delete to anon, authenticated using (true);

create table if not exists public.marketplace_listing (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  seller_name text not null,
  title text not null check (char_length(title) between 1 and 80),
  price numeric(12, 2) not null check (price >= 0),
  previous_price numeric(12, 2),
  location text not null,
  category text not null check (category in (
    'Vehicles', 'Property Rentals', 'Apparel', 'Classifieds', 'Electronics',
    'Entertainment', 'Family', 'Free Stuff', 'Garden & Outdoor', 'Hobbies',
    'Home Goods', 'Home Improvement Supplies', 'Home Sales',
    'Musical Instruments', 'Office Supplies', 'Pet Supplies', 'Sporting Goods',
    'Toys & Games'
  )),
  condition text not null,
  description text not null default '',
  photos text[] not null default '{}',
  category_details jsonb not null default '{}'::jsonb,
  color text,
  material text,
  created_at timestamptz not null default now()
);
alter table public.marketplace_listing add column if not exists photos text[] not null default '{}';
alter table public.marketplace_listing add column if not exists category_details jsonb not null default '{}'::jsonb;
alter table public.marketplace_listing add column if not exists color text;
alter table public.marketplace_listing add column if not exists material text;
alter table public.marketplace_listing add column if not exists previous_price numeric(12, 2);
create index if not exists marketplace_listing_created_at_idx
  on public.marketplace_listing (created_at desc);
create index if not exists marketplace_listing_category_idx
  on public.marketplace_listing (category);
create index if not exists marketplace_listing_seller_id_idx
  on public.marketplace_listing (seller_id);
alter table public.marketplace_listing enable row level security;
revoke all on table public.marketplace_listing from anon, authenticated;
grant select, insert on table public.marketplace_listing to anon, authenticated;
create policy "Marketplace listings are publicly readable"
  on public.marketplace_listing for select to anon, authenticated using (true);
create policy "Profiles can publish marketplace listings"
  on public.marketplace_listing for insert to anon, authenticated with check (true);

create table if not exists public.marketplace_listing_likes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listing(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint marketplace_listing_likes_unique_profile unique (listing_id, user_id)
);
create index if not exists marketplace_listing_likes_listing_idx
  on public.marketplace_listing_likes (listing_id, created_at desc);
alter table public.marketplace_listing_likes replica identity full;
alter table public.marketplace_listing_likes enable row level security;
revoke all on table public.marketplace_listing_likes from anon, authenticated;
grant select, insert, delete on table public.marketplace_listing_likes to anon, authenticated;
create policy "Listing likes are publicly readable"
  on public.marketplace_listing_likes for select to anon, authenticated using (true);
create policy "Profiles can like listings"
  on public.marketplace_listing_likes for insert to anon, authenticated with check (true);
create policy "Listing likes can be removed by the app"
  on public.marketplace_listing_likes for delete to anon, authenticated using (true);

create table if not exists public.marketplace_listing_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listing(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null default '',
  image text[],
  created_at timestamptz not null default now(),
  constraint marketplace_listing_comments_body_or_image_check check (
    char_length(btrim(body)) <= 2000
    and coalesce(cardinality(image), 0) <= 5
    and (char_length(btrim(body)) > 0 or coalesce(cardinality(image), 0) > 0)
  )
);
alter table public.marketplace_listing_comments add column if not exists image text[];
alter table public.marketplace_listing_comments replica identity full;
alter table public.marketplace_listing_comments alter column body set default '';
alter table public.marketplace_listing_comments
  drop constraint if exists marketplace_listing_comments_body_check;
alter table public.marketplace_listing_comments
  drop constraint if exists marketplace_listing_comments_body_or_image_check;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketplace_listing_comments'
      and column_name = 'image'
      and udt_name = 'text'
  ) then
    alter table public.marketplace_listing_comments
      alter column image type text[]
      using case when image is null then null else array[image] end;
  end if;
end
$$;
alter table public.marketplace_listing_comments
  add constraint marketplace_listing_comments_body_or_image_check check (
    char_length(btrim(body)) <= 2000
    and coalesce(cardinality(image), 0) <= 5
    and (char_length(btrim(body)) > 0 or coalesce(cardinality(image), 0) > 0)
  );
create index if not exists marketplace_listing_comments_listing_created_at_idx
  on public.marketplace_listing_comments (listing_id, created_at asc);
alter table public.marketplace_listing_comments enable row level security;
revoke all on table public.marketplace_listing_comments from anon, authenticated;
grant select, insert, delete on table public.marketplace_listing_comments to anon, authenticated;
create policy "Listing comments are publicly readable"
  on public.marketplace_listing_comments for select to anon, authenticated using (true);
create policy "Profiles can comment on listings"
  on public.marketplace_listing_comments for insert to anon, authenticated with check (true);
create policy "Listing comments can be deleted by the app"
  on public.marketplace_listing_comments for delete to anon, authenticated using (true);

-- Keep the single general message table and fold in any old marketplace rows.
do $$
begin
  if to_regclass('public.marketplace_message') is not null then
    if to_regclass('public.message') is null then
      alter table public.marketplace_message rename to message;
    else
      insert into public.message (id, listing_id, sender_id, recipient_id, body, created_at)
      select id, listing_id, sender_id, recipient_id, body, created_at
      from public.marketplace_message
      on conflict (id) do nothing;
      drop table public.marketplace_message;
    end if;
  end if;
end
$$;

create table if not exists public.message (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listing(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint message_distinct_participants check (sender_id <> recipient_id)
);
create index if not exists message_listing_created_at_idx
  on public.message (listing_id, created_at desc);
create index if not exists message_sender_created_at_idx
  on public.message (sender_id, created_at desc);
create index if not exists message_recipient_created_at_idx
  on public.message (recipient_id, created_at desc);
alter table public.message enable row level security;
revoke all on table public.message from anon, authenticated;
grant select, insert on table public.message to anon, authenticated;
create policy "Marketplace messages are readable by the app"
  on public.message for select to anon, authenticated using (true);
create policy "Profiles can send marketplace messages"
  on public.message for insert to anon, authenticated
  with check (
    sender_id <> recipient_id
    and exists (
      select 1 from public.marketplace_listing as listing
      where listing.id = listing_id and listing.seller_id = recipient_id
    )
  );

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction text not null check (char_length(reaction) <= 20),
  created_at timestamptz not null default now()
);
alter table public.message_reactions drop constraint if exists message_reactions_unique_owner;
alter table public.message_reactions drop constraint if exists message_reactions_unique_profile;
alter table public.message_reactions
  add constraint message_reactions_unique_profile unique (message_id, user_id, reaction);
create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id, created_at asc);
alter table public.message_reactions enable row level security;
revoke all on table public.message_reactions from anon, authenticated;
grant select, insert, delete on table public.message_reactions to anon, authenticated;
create policy "Message reactions are publicly readable"
  on public.message_reactions for select to anon, authenticated using (true);
create policy "Profiles can react to marketplace messages"
  on public.message_reactions for insert to anon, authenticated with check (true);
create policy "Message reactions can be removed by the app"
  on public.message_reactions for delete to anon, authenticated using (true);

-- Public image buckets accept images uploaded beneath a public profile id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-images', 'post-images', true, 5242880, array['image/*']),
  ('marketplace-listing-images', 'marketplace-listing-images', true, 5242880, array['image/*']),
  ('profile-images', 'profile-images', true, 5242880, array['image/*'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Piecebook images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('post-images', 'marketplace-listing-images', 'profile-images'));
create policy "Profiles can upload Piecebook images"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id in ('post-images', 'marketplace-listing-images', 'profile-images')
    and exists (
      select 1 from public.users as profile
      where profile.id::text = (storage.foldername(name))[1]
    )
  );
create policy "Profiles can replace Piecebook images"
  on storage.objects for update to anon, authenticated
  using (bucket_id in ('post-images', 'marketplace-listing-images', 'profile-images'))
  with check (bucket_id in ('post-images', 'marketplace-listing-images', 'profile-images'));
create policy "Profiles can delete Piecebook images"
  on storage.objects for delete to anon, authenticated
  using (bucket_id in ('post-images', 'marketplace-listing-images', 'profile-images'));

-- Realtime follows the currently selected client-side profile. Listing row
-- changes remain outside the realtime channel by design.
do $$
declare
  realtime_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach realtime_table in array array[
      'posts',
      'post_comments',
      'marketplace_listing_likes',
      'marketplace_listing_comments',
      'message',
      'message_reactions'
    ] loop
      if to_regclass(format('public.%I', realtime_table)) is not null
        and not exists (
          select 1 from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = realtime_table
        ) then
        execute format('alter publication supabase_realtime add table public.%I', realtime_table);
      end if;
    end loop;
  end if;
end
$$;
