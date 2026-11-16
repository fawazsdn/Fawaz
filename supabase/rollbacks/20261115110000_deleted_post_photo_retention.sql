-- Rollback of 20261115110000_deleted_post_photo_retention: restores the cleanup functions of
-- 20261110090000 (photos of deleted posts are kept again). No data changes.
begin;
create or replace function public.claim_abandoned_post_photos(
  older_than interval default interval '24 hours', max_rows integer default 200, stale_after interval default interval '1 hour')
returns table(object_path text) language plpgsql security definer set search_path to '' as $$
begin
  return query
  with c as (
    select a.id from public.media_attachments a
    where a.bucket_id = 'community-media' and a.object_path like 'posts/%'
      and not private.post_photo_in_use(a.object_path)
      and ((a.status = 'staged' and a.created_at < now() - older_than)
           or (a.status = 'deleting' and (a.claimed_at is null or a.claimed_at < now() - stale_after)))
    order by a.created_at
    limit greatest(1, least(coalesce(max_rows, 200), 1000))
    for update skip locked
  )
  update public.media_attachments m set status = 'deleting', claimed_at = now()
  from c where m.id = c.id
  returning m.object_path;
end; $$;

create or replace function public.count_abandoned_post_photos(older_than interval default interval '24 hours')
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'staged_abandoned', count(*) filter (where a.status = 'staged' and a.created_at < now() - older_than and not private.post_photo_in_use(a.object_path)),
    'deleting', count(*) filter (where a.status = 'deleting'))
  from public.media_attachments a where a.bucket_id = 'community-media' and a.object_path like 'posts/%';
$$;

drop function if exists private.deleted_post_photo_due(text, interval);
commit;
