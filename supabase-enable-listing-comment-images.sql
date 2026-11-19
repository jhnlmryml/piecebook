do $$
begin
  if to_regclass('public.marketplace_listing_comments') is null then
    raise exception 'The public.marketplace_listing_comments table does not exist.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketplace_listing_comments'
      and column_name = 'image'
  ) then
    alter table public.marketplace_listing_comments add column image text[];
  end if;

  alter table public.marketplace_listing_comments
    drop constraint if exists marketplace_listing_comments_body_check;
  alter table public.marketplace_listing_comments
    drop constraint if exists marketplace_listing_comments_body_or_image_check;

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

  alter table public.marketplace_listing_comments
    add constraint marketplace_listing_comments_body_or_image_check check (
      char_length(btrim(body)) <= 2000
      and coalesce(cardinality(image), 0) <= 5
      and (
        char_length(btrim(body)) > 0
        or coalesce(cardinality(image), 0) > 0
      )
    );
end
$$;
