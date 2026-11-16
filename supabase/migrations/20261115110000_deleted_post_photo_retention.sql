-- =============================================================================
-- Haratna: photos of deleted posts are removed after a 24-hour recovery grace.
--
-- STATUS: NOT APPLIED TO PRODUCTION. Requires the owner's explicit approval.
-- Depends on 20261110090000 (cleanup protocol) and 20261115100000.
-- Tests:    supabase/tests/deleted_post_retention.sql
-- Rollback: supabase/rollbacks/20261115110000_deleted_post_photo_retention.sql
--
-- Until now a deleted post (soft delete) kept its photos in Storage indefinitely; the
-- cleanup job only took never-published uploads. Now an attached photo becomes due once
-- no live post uses it, it is referenced by at least one deleted post, and every post that
-- references it was deleted more than the grace period ago. The grace is the larger of the
-- job's `older_than` and 24 hours, so a short test or manual run can never shorten the
-- recovery window. During the grace the photo stays (a moderator can still restore the
-- post); afterwards the existing claim -> Storage delete -> finish protocol removes it.
-- A photo reused by a live post is never taken. No data is changed by this file.
-- =============================================================================

create or replace function private.deleted_post_photo_due(object_name text, older_than interval)
returns boolean language sql stable security definer set search_path to '' as $$
  select not private.post_photo_in_use(object_name)
    and exists (select 1 from public.posts p where p.image_paths @> array[object_name] and p.deleted_at is not null)
    and not exists (select 1 from public.posts p where p.image_paths @> array[object_name]
                    and (p.deleted_at is null or p.deleted_at >= now() - greatest(older_than, interval '24 hours')));
$$;
revoke all on function private.deleted_post_photo_due(text, interval) from public, anon, authenticated;

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
           or (a.status = 'attached' and private.deleted_post_photo_due(a.object_path, older_than))
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
    'deleted_post_photos', count(*) filter (where a.status = 'attached' and private.deleted_post_photo_due(a.object_path, older_than)),
    'deleting', count(*) filter (where a.status = 'deleting'))
  from public.media_attachments a where a.bucket_id = 'community-media' and a.object_path like 'posts/%';
$$;
