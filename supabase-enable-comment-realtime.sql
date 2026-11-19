do $$
begin
  if to_regclass('public.post_comments') is null then
    raise exception 'The public.post_comments table does not exist.';
  end if;

  alter table public.post_comments replica identity full;

  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'The supabase_realtime publication does not exist.';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.post_comments';
  end if;
end
$$;
