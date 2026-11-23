-- Apply to existing Supabase databases to support the wall feed ordering and
-- batched latest-comment lookup. The canonical definitions also live in
-- supabase-schema.sql for new databases.
create index if not exists posts_created_at_idx
  on public.posts (created_at desc, id desc);

create index if not exists post_comments_post_created_id_idx
  on public.post_comments (post_id, created_at desc, id desc);
