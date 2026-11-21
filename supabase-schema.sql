-- Piecebook profile-based schema
-- This app uses public.users rows as selectable personas. It does not use
-- Supabase Auth. The selected profile id is a client-side identity only.
-- Applying this schema removes owner_id columns and replaces Auth-only RLS
-- policies with public policies so the anon key can read and write app data.
-- This is suitable for a demo app, not private or production user data.
-- This file is the single schema source of truth; it retains additive
-- migrations for existing databases. It is not safe for private user data.
-- Run in the Supabase SQL Editor after backing up an existing database.

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
      'marketplace_listing_like_archive', 'marketplace_listing_comment_archive',
      'marketplace_orders', 'message', 'message_reactions', 'marketplace_message',
      'message_hidden_for', 'message_conversation_preferences'
    ]))
      or (schemaname = 'storage' and tablename = 'objects' and (
        (coalesce(qual, '') || coalesce(with_check, '')) ilike '%post-images%'
        or (coalesce(qual, '') || coalesce(with_check, '')) ilike '%marketplace-listing-images%'
        or (coalesce(qual, '') || coalesce(with_check, '')) ilike '%profile-images%'
        or (coalesce(qual, '') || coalesce(with_check, '')) ilike '%message-attachments%'
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

-- A neutral persona keeps a fresh demo database usable without importing
-- production or fictional profile data.
insert into public.users (id, email, full_name, role, location, interests)
values (
  '00000000-0000-4000-8000-000000000001',
  'demo@example.test',
  'Demo member',
  'Member',
  '',
  '{}'
)
on conflict (id) do nothing;

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

create or replace function public.set_post_like(
  requested_post_id uuid,
  requested_profile_id uuid,
  should_like boolean
)
returns text[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  updated_likes text[];
begin
  update public.posts
  set likes_by = case
    when should_like then
      case
        when requested_profile_id::text = any(coalesce(likes_by, array[]::text[]))
          then coalesce(likes_by, array[]::text[])
        else array_append(coalesce(likes_by, array[]::text[]), requested_profile_id::text)
      end
    else array_remove(coalesce(likes_by, array[]::text[]), requested_profile_id::text)
  end
  where id = requested_post_id
  returning likes_by into updated_likes;

  if not found then
    return null;
  end if;
  return updated_likes;
end;
$$;
revoke all on function public.set_post_like(uuid, uuid, boolean) from public;
grant execute on function public.set_post_like(uuid, uuid, boolean) to anon, authenticated;



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
  seller_email text,
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
  quantity integer not null default 1 check (quantity >= 0),
  status text not null default 'available' check (status in ('available', 'pending', 'sold')),
  created_at timestamptz not null default now()
);
alter table public.marketplace_listing add column if not exists photos text[] not null default '{}';
alter table public.marketplace_listing add column if not exists seller_email text;
alter table public.marketplace_listing add column if not exists category_details jsonb not null default '{}'::jsonb;
alter table public.marketplace_listing add column if not exists color text;
alter table public.marketplace_listing add column if not exists material text;
alter table public.marketplace_listing add column if not exists previous_price numeric(12, 2);
alter table public.marketplace_listing add column if not exists quantity integer not null default 1;
alter table public.marketplace_listing add column if not exists status text not null default 'available';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketplace_listing'::regclass
      and conname = 'marketplace_listing_quantity_check'
  ) then
    alter table public.marketplace_listing
      add constraint marketplace_listing_quantity_check check (quantity >= 0);
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketplace_listing'::regclass
      and conname = 'marketplace_listing_status_check'
  ) then
    alter table public.marketplace_listing
      add constraint marketplace_listing_status_check
      check (status in ('available', 'pending', 'sold'));
  end if;
end
$$;
create index if not exists marketplace_listing_created_at_idx
  on public.marketplace_listing (created_at desc);
create index if not exists marketplace_listing_category_idx
  on public.marketplace_listing (category);
create index if not exists marketplace_listing_seller_id_idx
  on public.marketplace_listing (seller_id);
alter table public.marketplace_listing enable row level security;
revoke all on table public.marketplace_listing from anon, authenticated;
grant select, insert, update, delete on table public.marketplace_listing to anon, authenticated;
create policy "Marketplace listings are publicly readable"
  on public.marketplace_listing for select to anon, authenticated using (true);
create policy "Profiles can publish marketplace listings"
  on public.marketplace_listing for insert to anon, authenticated with check (true);
create policy "Profiles can update marketplace listings"
  on public.marketplace_listing for update to anon, authenticated using (true) with check (true);
create policy "Profiles can delete marketplace listings"
  on public.marketplace_listing for delete to anon, authenticated using (true);

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
  on public.marketplace_listing_likes for insert to anon, authenticated with check (
    exists (
      select 1 from public.marketplace_listing
      where id = listing_id
        and (status = 'sold' or (status = 'available' and quantity > 0))
    )
  );
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
  on public.marketplace_listing_comments for insert to anon, authenticated with check (
    exists (
      select 1 from public.marketplace_listing
      where id = listing_id
        and (status = 'sold' or (status = 'available' and quantity > 0))
    )
  );
create policy "Listing comments can be deleted by the app"
  on public.marketplace_listing_comments for delete to anon, authenticated using (true);

drop trigger if exists marketplace_listing_likes_require_available on public.marketplace_listing_likes;
drop trigger if exists marketplace_listing_comments_require_available on public.marketplace_listing_comments;
drop trigger if exists marketplace_listing_likes_require_engageable on public.marketplace_listing_likes;
drop trigger if exists marketplace_listing_comments_require_engageable on public.marketplace_listing_comments;
drop function if exists public.require_available_marketplace_listing_for_engagement();

create or replace function public.require_marketplace_listing_for_engagement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_status text;
  selected_quantity integer;
begin
  select status, quantity
    into selected_status, selected_quantity
    from public.marketplace_listing
    where id = new.listing_id
    for share;

  if not found
    or selected_status not in ('available', 'sold')
    or (selected_status = 'available' and selected_quantity < 1)
  then
    raise exception 'This item no longer accepts likes or comments.';
  end if;

  return new;
end;
$$;
revoke all on function public.require_marketplace_listing_for_engagement() from public;
create trigger marketplace_listing_likes_require_engageable
  before insert or update on public.marketplace_listing_likes
  for each row execute function public.require_marketplace_listing_for_engagement();
create trigger marketplace_listing_comments_require_engageable
  before insert or update on public.marketplace_listing_comments
  for each row execute function public.require_marketplace_listing_for_engagement();

create table if not exists public.marketplace_listing_like_archive (
  id uuid primary key default gen_random_uuid(),
  source_listing_id uuid not null,
  source_like_id uuid not null,
  user_id uuid not null,
  user_name text not null,
  user_image text,
  created_at timestamptz not null,
  constraint marketplace_listing_like_archive_unique unique (source_listing_id, source_like_id)
);
create index if not exists marketplace_listing_like_archive_listing_idx
  on public.marketplace_listing_like_archive (source_listing_id, created_at);
alter table public.marketplace_listing_like_archive enable row level security;
revoke all on table public.marketplace_listing_like_archive from anon, authenticated;
grant select on table public.marketplace_listing_like_archive to anon, authenticated;
create policy "Archived listing likes are readable by the app"
  on public.marketplace_listing_like_archive for select to anon, authenticated using (true);

create table if not exists public.marketplace_listing_comment_archive (
  id uuid primary key default gen_random_uuid(),
  source_listing_id uuid not null,
  source_comment_id uuid not null,
  user_id uuid not null,
  user_name text not null,
  user_image text,
  body text not null,
  image text[],
  created_at timestamptz not null,
  constraint marketplace_listing_comment_archive_unique unique (source_listing_id, source_comment_id)
);
create index if not exists marketplace_listing_comment_archive_listing_idx
  on public.marketplace_listing_comment_archive (source_listing_id, created_at, id);
alter table public.marketplace_listing_comment_archive enable row level security;
revoke all on table public.marketplace_listing_comment_archive from anon, authenticated;
grant select on table public.marketplace_listing_comment_archive to anon, authenticated;
create policy "Archived listing comments are readable by the app"
  on public.marketplace_listing_comment_archive for select to anon, authenticated using (true);

create or replace function public.archive_marketplace_listing_engagement(
  requested_source_listing_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.marketplace_listing_like_archive as archived_like
  where archived_like.source_listing_id = requested_source_listing_id
    and not exists (
      select 1
      from public.marketplace_listing_likes as listing_like
      where listing_like.id = archived_like.source_like_id
        and listing_like.listing_id = requested_source_listing_id
    );

  delete from public.marketplace_listing_comment_archive as archived_comment
  where archived_comment.source_listing_id = requested_source_listing_id
    and not exists (
      select 1
      from public.marketplace_listing_comments as listing_comment
      where listing_comment.id = archived_comment.source_comment_id
        and listing_comment.listing_id = requested_source_listing_id
    );

  insert into public.marketplace_listing_like_archive (
    source_listing_id, source_like_id, user_id, user_name, user_image, created_at
  )
  select
    requested_source_listing_id,
    listing_like.id,
    listing_like.user_id,
    coalesce(nullif(btrim(profile.full_name), ''), 'Piecebook member'),
    profile.image,
    listing_like.created_at
  from public.marketplace_listing_likes as listing_like
  left join public.users as profile on profile.id = listing_like.user_id
  where listing_like.listing_id = requested_source_listing_id
  on conflict (source_listing_id, source_like_id) do nothing;

  insert into public.marketplace_listing_comment_archive (
    source_listing_id, source_comment_id, user_id, user_name, user_image, body, image, created_at
  )
  select
    requested_source_listing_id,
    listing_comment.id,
    listing_comment.user_id,
    coalesce(nullif(btrim(profile.full_name), ''), 'Piecebook member'),
    profile.image,
    listing_comment.body,
    listing_comment.image,
    listing_comment.created_at
  from public.marketplace_listing_comments as listing_comment
  left join public.users as profile on profile.id = listing_comment.user_id
  where listing_comment.listing_id = requested_source_listing_id
  on conflict (source_listing_id, source_comment_id) do nothing;
end;
$$;
revoke all on function public.archive_marketplace_listing_engagement(uuid) from public;

create or replace function public.archive_sold_marketplace_listing_engagement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    perform public.archive_marketplace_listing_engagement(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.archive_deleted_marketplace_listing_engagement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.archive_marketplace_listing_engagement(old.id);
  return old;
end;
$$;
drop trigger if exists marketplace_listing_archive_sold_engagement on public.marketplace_listing;
create trigger marketplace_listing_archive_sold_engagement
  after update of status on public.marketplace_listing
  for each row execute function public.archive_sold_marketplace_listing_engagement();
drop trigger if exists marketplace_listing_archive_deleted_engagement on public.marketplace_listing;
create trigger marketplace_listing_archive_deleted_engagement
  before delete on public.marketplace_listing
  for each row execute function public.archive_deleted_marketplace_listing_engagement();

do $$
declare
  sold_listing record;
begin
  for sold_listing in
    select id from public.marketplace_listing where status = 'sold'
  loop
    perform public.archive_marketplace_listing_engagement(sold_listing.id);
  end loop;
end;
$$;

create or replace view public.marketplace_listing_engagement_counts
with (security_invoker = true) as
select
  listing.id as listing_id,
  coalesce(likes.like_count, 0::bigint) as like_count,
  coalesce(comments.comment_count, 0::bigint) as comment_count
from public.marketplace_listing as listing
left join (
  select listing_id, count(*) as like_count
  from public.marketplace_listing_likes
  group by listing_id
) as likes on likes.listing_id = listing.id
left join (
  select listing_id, count(*) as comment_count
  from public.marketplace_listing_comments
  group by listing_id
) as comments on comments.listing_id = listing.id;
grant select on public.marketplace_listing_engagement_counts to anon, authenticated;

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
  listing_id uuid references public.marketplace_listing(id) on delete set null,
  marketplace_order_id uuid,
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

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  source_listing_id uuid not null,
  listing_id uuid references public.marketplace_listing(id) on delete set null,
  buyer_id uuid not null references public.users(id) on delete restrict,
  seller_id uuid not null references public.users(id) on delete restrict,
  buyer_name text not null,
  buyer_role text,
  buyer_location text,
  buyer_image text,
  seller_name text not null,
  seller_role text,
  seller_location text,
  seller_image text,
  listing_title text not null,
  listing_previous_price numeric(12, 2),
  listing_category text not null default '',
  listing_condition text not null default '',
  listing_description text not null default '',
  listing_location text not null default '',
  listing_photos text[] not null default '{}',
  listing_category_details jsonb not null default '{}'::jsonb,
  listing_color text,
  listing_material text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  constraint marketplace_orders_distinct_profiles check (buyer_id <> seller_id)
);
alter table public.message
  add column if not exists marketplace_order_id uuid;
alter table public.message
  drop constraint if exists message_marketplace_order_id_fkey;
alter table public.message
  add constraint message_marketplace_order_id_fkey
  foreign key (marketplace_order_id) references public.marketplace_orders(id) on delete set null;
alter table public.marketplace_orders
  add column if not exists source_listing_id uuid,
  add column if not exists buyer_location text,
  add column if not exists buyer_image text,
  add column if not exists buyer_role text,
  add column if not exists seller_location text,
  add column if not exists seller_image text,
  add column if not exists seller_role text,
  add column if not exists listing_previous_price numeric(12, 2),
  add column if not exists listing_category text not null default '',
  add column if not exists listing_condition text not null default '',
  add column if not exists listing_description text not null default '',
  add column if not exists listing_location text not null default '',
  add column if not exists listing_photos text[] not null default '{}',
  add column if not exists listing_category_details jsonb not null default '{}'::jsonb,
  add column if not exists listing_color text,
  add column if not exists listing_material text;

-- Backfill snapshots for existing orders before relying on saved item data.
update public.marketplace_orders as order_record
set
  source_listing_id = coalesce(order_record.source_listing_id, order_record.listing_id),
  buyer_name = case
    when nullif(btrim(order_record.buyer_name), '') is null
      or btrim(order_record.buyer_name) = 'Buyer'
    then coalesce(nullif(btrim(buyer.full_name), ''), order_record.buyer_name)
    else order_record.buyer_name
  end,
  buyer_location = coalesce(order_record.buyer_location, buyer.location),
  buyer_image = coalesce(order_record.buyer_image, buyer.image),
  buyer_role = coalesce(order_record.buyer_role, buyer.role),
  seller_name = case
    when nullif(btrim(order_record.seller_name), '') is null
      or btrim(order_record.seller_name) in ('Seller', 'You')
    then coalesce(nullif(btrim(seller.full_name), ''), order_record.seller_name)
    else order_record.seller_name
  end,
  seller_location = coalesce(order_record.seller_location, seller.location),
  seller_image = coalesce(order_record.seller_image, seller.image),
  seller_role = coalesce(order_record.seller_role, seller.role),
  listing_category = coalesce(nullif(order_record.listing_category, ''), listing.category, ''),
  listing_condition = coalesce(nullif(order_record.listing_condition, ''), listing.condition, ''),
  listing_description = coalesce(nullif(order_record.listing_description, ''), listing.description, ''),
  listing_location = coalesce(nullif(order_record.listing_location, ''), listing.location, ''),
  listing_photos = case
    when cardinality(order_record.listing_photos) = 0 then coalesce(listing.photos, order_record.listing_photos)
    else order_record.listing_photos
  end,
  listing_category_details = case
    when order_record.listing_category_details = '{}'::jsonb then coalesce(listing.category_details, order_record.listing_category_details)
    else order_record.listing_category_details
  end,
  listing_color = coalesce(order_record.listing_color, listing.color),
  listing_material = coalesce(order_record.listing_material, listing.material),
  listing_previous_price = coalesce(order_record.listing_previous_price, listing.previous_price)
from public.marketplace_orders as previous_order
left join public.marketplace_listing as listing on listing.id = previous_order.listing_id
left join public.users as buyer on buyer.id = previous_order.buyer_id
left join public.users as seller on seller.id = previous_order.seller_id
where order_record.id = previous_order.id;

create index if not exists marketplace_orders_buyer_created_at_idx
  on public.marketplace_orders (buyer_id, created_at desc);
create index if not exists marketplace_orders_seller_created_at_idx
  on public.marketplace_orders (seller_id, created_at desc);
create index if not exists marketplace_orders_source_listing_idx
  on public.marketplace_orders (source_listing_id);
alter table public.marketplace_orders enable row level security;
revoke all on table public.marketplace_orders from anon, authenticated;
grant select on table public.marketplace_orders to anon, authenticated;
create policy "Marketplace orders are readable by the app"
  on public.marketplace_orders for select to anon, authenticated using (true);

create or replace function public.checkout_marketplace_listing(
  requested_listing_id uuid,
  requested_buyer_id uuid,
  requested_quantity integer
)
returns public.marketplace_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_listing public.marketplace_listing%rowtype;
  selected_buyer public.users%rowtype;
  selected_seller public.users%rowtype;
  created_order public.marketplace_orders%rowtype;
  remaining_quantity integer;
begin
  if requested_quantity is null or requested_quantity < 1 then
    raise exception 'Choose a quantity of at least one.';
  end if;

  select *
    into selected_buyer
    from public.users
    where id = requested_buyer_id;
  if not found then
    raise exception 'The selected buyer profile could not be found.';
  end if;

  select *
    into selected_listing
    from public.marketplace_listing
    where id = requested_listing_id
    for update;
  if not found then
    raise exception 'This listing is no longer available.';
  end if;
  if selected_listing.seller_id = requested_buyer_id then
    raise exception 'You cannot buy your own listing.';
  end if;
  select *
    into selected_seller
    from public.users
    where id = selected_listing.seller_id;
  if not found then
    raise exception 'The seller profile for this listing could not be found.';
  end if;
  if selected_listing.status <> 'available' then
    raise exception 'This listing is no longer available.';
  end if;
  if selected_listing.quantity < requested_quantity then
    raise exception 'There is not enough stock for that quantity.';
  end if;

  remaining_quantity := selected_listing.quantity - requested_quantity;
  update public.marketplace_listing
    set quantity = remaining_quantity,
        status = case when remaining_quantity = 0 then 'sold' else 'available' end
    where id = selected_listing.id;

  insert into public.marketplace_orders (
    source_listing_id,
    listing_id,
    buyer_id,
    seller_id,
    buyer_name,
    buyer_role,
    buyer_location,
    buyer_image,
    seller_name,
    seller_role,
    seller_location,
    seller_image,
    listing_title,
    listing_previous_price,
    listing_category,
    listing_condition,
    listing_description,
    listing_location,
    listing_photos,
    listing_category_details,
    listing_color,
    listing_material,
    unit_price,
    quantity,
    total_price
  )
  values (
    selected_listing.id,
    selected_listing.id,
    selected_buyer.id,
    selected_listing.seller_id,
    coalesce(nullif(btrim(selected_buyer.full_name), ''), 'Buyer'),
    selected_buyer.role,
    selected_buyer.location,
    selected_buyer.image,
    coalesce(nullif(btrim(selected_seller.full_name), ''), selected_listing.seller_name),
    selected_seller.role,
    selected_seller.location,
    selected_seller.image,
    selected_listing.title,
    selected_listing.previous_price,
    selected_listing.category,
    selected_listing.condition,
    selected_listing.description,
    selected_listing.location,
    selected_listing.photos,
    selected_listing.category_details,
    selected_listing.color,
    selected_listing.material,
    selected_listing.price,
    requested_quantity,
    selected_listing.price * requested_quantity
  )
  returning * into created_order;

  insert into public.message (listing_id, marketplace_order_id, sender_id, recipient_id, body)
  values (
    selected_listing.id,
    created_order.id,
    selected_buyer.id,
    selected_listing.seller_id,
    left(
      format(
        'Order placed: %s bought %s x %s for $%s. Order #%s.',
        created_order.buyer_name,
        created_order.quantity,
        created_order.listing_title,
        to_char(created_order.total_price, 'FM999,999,999,990.00'),
        left(created_order.id::text, 8)
      ),
      1000
    )
  );

  return created_order;
end;
$$;
revoke all on function public.checkout_marketplace_listing(uuid, uuid, integer)
  from public;
grant execute on function public.checkout_marketplace_listing(uuid, uuid, integer)
  to anon, authenticated;

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
grant select, insert, update, delete on table public.message_reactions to anon, authenticated;
create policy "Message reactions are publicly readable"
  on public.message_reactions for select to anon, authenticated using (true);
create policy "Profiles can react to marketplace messages"
  on public.message_reactions for insert to anon, authenticated with check (true);
drop policy if exists "Message reactions can be updated by the app" on public.message_reactions;
create policy "Message reactions can be updated by the app"
  on public.message_reactions for update to anon, authenticated using (true) with check (true);
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
create policy "Profiles can delete Piecebook images"
  on storage.objects for delete to anon, authenticated
  using (
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

-- Global messaging extends the marketplace message table without introducing
-- a second message schema.
alter table public.message
  alter column listing_id drop not null,
  add column if not exists read_at timestamptz,
  add column if not exists edited_at timestamptz,
  add column if not exists attachments jsonb;

alter table public.message
  drop constraint if exists message_body_check,
  drop constraint if exists message_body_or_attachment_check,
  add constraint message_body_or_attachment_check check (
    char_length(body) between 1 and 1000
    or (
      char_length(body) = 0
      and attachments is not null
      and case
        when jsonb_typeof(attachments) = 'array' then jsonb_array_length(attachments) > 0
        else false
      end
    )
  );

drop policy if exists "Profiles can send marketplace messages" on public.message;
drop policy if exists "Profiles can send messages" on public.message;
create policy "Profiles can send messages"
  on public.message for insert to anon, authenticated
  with check (
    sender_id <> recipient_id
    and (
      listing_id is null
      or exists (
        select 1
        from public.marketplace_listing as listing
        where listing.id = listing_id
          and listing.seller_id in (sender_id, recipient_id)
      )
    )
  );

drop policy if exists "Messages can be updated by the app" on public.message;
create policy "Messages can be updated by the app"
  on public.message for update to anon, authenticated using (true) with check (true);

drop policy if exists "Messages can be deleted by the app" on public.message;
create policy "Messages can be deleted by the app"
  on public.message for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.message to anon, authenticated;

create or replace function public.enforce_message_edit_window()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    if now() > old.created_at + interval '30 minutes' then
      raise exception 'Messages can only be edited within 30 minutes of sending.';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists message_edit_window on public.message;
create trigger message_edit_window
  before update on public.message
  for each row execute function public.enforce_message_edit_window();

-- Retain each profile's most recent reaction before enforcing one per message.
delete from public.message_reactions as older
using public.message_reactions as newer
where older.message_id = newer.message_id
  and older.user_id = newer.user_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

alter table public.message_reactions
  drop constraint if exists message_reactions_unique_profile;
alter table public.message_reactions
  add constraint message_reactions_unique_profile unique (message_id, user_id);

create table if not exists public.message_hidden_for (
  profile_id uuid not null references public.users(id) on delete cascade,
  message_id uuid not null references public.message(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, message_id)
);
create index if not exists message_hidden_for_message_id_idx
  on public.message_hidden_for(message_id);
alter table public.message_hidden_for enable row level security;
revoke all on table public.message_hidden_for from anon, authenticated;
grant select, insert, delete on table public.message_hidden_for to anon, authenticated;
drop policy if exists "Hidden messages are readable by the app" on public.message_hidden_for;
create policy "Hidden messages are readable by the app"
  on public.message_hidden_for for select to anon, authenticated using (true);
drop policy if exists "Profiles can hide messages for themselves" on public.message_hidden_for;
create policy "Profiles can hide messages for themselves"
  on public.message_hidden_for for insert to anon, authenticated with check (true);
drop policy if exists "Hidden messages can be restored by the app" on public.message_hidden_for;
create policy "Hidden messages can be restored by the app"
  on public.message_hidden_for for delete to anon, authenticated using (true);

create table if not exists public.message_conversation_preferences (
  profile_id uuid not null references public.users(id) on delete cascade,
  partner_id uuid not null references public.users(id) on delete cascade,
  archived boolean not null default false,
  deleted_before timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, partner_id),
  constraint message_conversation_preferences_distinct_profiles
    check (profile_id <> partner_id)
);
alter table public.message_conversation_preferences enable row level security;
revoke all on table public.message_conversation_preferences from anon, authenticated;
grant select, insert, update on public.message_conversation_preferences to anon, authenticated;
drop policy if exists "Conversation preferences are readable by the app" on public.message_conversation_preferences;
create policy "Conversation preferences are readable by the app"
  on public.message_conversation_preferences for select to anon, authenticated using (true);
drop policy if exists "Conversation preferences can be created by the app" on public.message_conversation_preferences;
create policy "Conversation preferences can be created by the app"
  on public.message_conversation_preferences for insert to anon, authenticated with check (true);
drop policy if exists "Conversation preferences can be updated by the app" on public.message_conversation_preferences;
create policy "Conversation preferences can be updated by the app"
  on public.message_conversation_preferences for update to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  true,
  10485760,
  array[
    'image/*',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Message attachments are publicly readable" on storage.objects;
create policy "Message attachments are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'message-attachments');
drop policy if exists "Profiles can upload message attachments" on storage.objects;
create policy "Profiles can upload message attachments"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.users as profile
      where profile.id::text = (storage.foldername(name))[1]
    )
  );
drop policy if exists "Profiles can delete message attachments" on storage.objects;
create policy "Profiles can delete message attachments"
  on storage.objects for delete to anon, authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.users as profile
      where profile.id::text = (storage.foldername(name))[1]
    )
  );
