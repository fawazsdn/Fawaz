-- =============================================================================
-- Haratna social resilience: idempotent posts/comments and a server-side guard
-- between post publication and abandoned-photo cleanup.
--
-- STATUS: NOT APPLIED TO PRODUCTION. Development only; requires the owner's
-- explicit approval. Depends on 20261109120000 and 20261109130000.
-- Tests:    supabase/tests/social_resilience.sql (+ concurrency drill)
-- Rollback: supabase/rollbacks/20261110090000_social_resilience.sql
--
-- 1. Idempotency. Posts and comments carry a client-generated operation id
--    (client_op_id), unique per author. publish_post / add_post_comment return
--    the existing row when the same author retries the same operation with the
--    same payload, and report a conflict (never a second row) when the payload
--    differs. Another account reusing the id gets its own, unrelated row.
-- 2. Photo guard. Every post photo upload (community-media/posts/<uid>/...) is
--    recorded in media_attachments as 'staged'. Publishing a post (through any
--    path, including a direct insert) locks those records, requires each photo
--    to belong to the author, still exist in Storage and not be claimed by
--    cleanup, and marks it 'attached'. Cleanup claims only 'staged' records
--    older than a cut-off, skipping anything locked or referenced, and marks
--    them 'deleting' before any file is removed; a claimed upload is never
--    publishable again, and failed deletions are retried by the next run.
--    Clients can never delete a photo a live post references (restrictive
--    storage policy). Job: supabase/functions/cleanup-post-photos.
-- =============================================================================

-- ------------------------------------------------------------ idempotency --
alter table public.posts add column if not exists client_op_id uuid;
alter table public.post_comments add column if not exists client_op_id uuid;
create unique index if not exists posts_author_client_op_idx on public.posts (author_id, client_op_id) where client_op_id is not null;
create unique index if not exists post_comments_author_client_op_idx on public.post_comments (author_id, client_op_id) where client_op_id is not null;

-- --------------------------------------------------------- photo lifecycle --
alter table public.media_attachments add column if not exists status text not null default 'attached';
alter table public.media_attachments add constraint media_attachments_status_check
  check (status in ('staged', 'attached', 'deleting'));
-- When cleanup claimed the upload (null = due for another attempt).
alter table public.media_attachments add column if not exists claimed_at timestamptz;
create index if not exists media_attachments_staged_idx on public.media_attachments (created_at) where status = 'staged';
create index if not exists media_attachments_deleting_idx on public.media_attachments (claimed_at) where status = 'deleting';

-- New post-photo uploads always start as 'staged' and unattached, whatever the client sends.
create or replace function private.stage_post_photo()
returns trigger language plpgsql security invoker set search_path to '' as $$
begin
  if new.bucket_id = 'community-media' and new.object_path like 'posts/%' then
    if split_part(new.object_path, '/', 2) <> new.owner_id::text then
      raise exception 'invalid:images' using errcode = '22023';
    end if;
    new.status := 'staged';
    new.entity_type := null;
    new.entity_id := null;
  elsif new.status <> 'attached' then
    new.status := 'attached';
  end if;
  return new;
end; $$;
create trigger media_attachments_stage_post_photo before insert on public.media_attachments
  for each row execute function private.stage_post_photo();

-- True while a live post references the object.
create or replace function private.post_photo_in_use(object_name text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.posts p where p.image_paths @> array[object_name] and p.deleted_at is null);
$$;

/**
 * Called by the posts guard for every posts/ photo on INSERT: lock the upload
 * records, require author ownership, existence in Storage and no cleanup
 * claim, then attach them to the post. Raises photo_unavailable otherwise.
 */
create or replace function private.attach_post_photos(author uuid, post uuid, paths text[])
returns void language plpgsql security definer set search_path to '' as $$
declare
  p text;
  rec record;
begin
  foreach p in array coalesce(paths, '{}') loop
    if p not like 'posts/%' then continue; end if;
    select a.id, a.owner_id, a.status into rec
    from public.media_attachments a
    where a.bucket_id = 'community-media' and a.object_path = p
    for update;
    if rec.id is null or rec.owner_id <> author or rec.status = 'deleting' then
      raise exception 'photo_unavailable' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'community-media' and o.name = p) then
      raise exception 'photo_unavailable' using errcode = '22023';
    end if;
    update public.media_attachments set status = 'attached', entity_type = 'post', entity_id = post where id = rec.id;
  end loop;
end; $$;

-- Extend the posts guard: inserts attach (and so validate) their posts/ photos.
create or replace function private.guard_post_write()
returns trigger language plpgsql security invoker set search_path to '' as $$
declare
  path text;
  parts text[];
  staff boolean := private.is_admin_or_moderator();
  client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'UPDATE' and client and not staff then
    if (new.author_id, new.neighborhood_id, new.type, new.created_at, new.linked_entity_type, new.linked_entity_id, new.pinned, new.client_op_id)
       is distinct from (old.author_id, old.neighborhood_id, old.type, old.created_at, old.linked_entity_type, old.linked_entity_id, old.pinned, old.client_op_id) then
      raise exception 'invalid:post_fields' using errcode = '42501';
    end if;
    if not (new.image_paths <@ old.image_paths) then
      raise exception 'invalid:images' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT' or new.image_paths is distinct from old.image_paths or new.audience is distinct from old.audience then
    foreach path in array new.image_paths loop
      parts := string_to_array(path, '/');
      if tg_op = 'INSERT' or client then
        if array_length(parts, 1) <> 3 or parts[2] <> new.author_id::text
           or not (parts[1] = 'posts' or parts[1] = new.neighborhood_id) then
          raise exception 'invalid:images' using errcode = '22023';
        end if;
      end if;
      if new.audience in ('public', 'followers') and parts[1] <> 'posts' then
        raise exception 'invalid:audience' using errcode = '22023';
      end if;
    end loop;
  end if;

  if tg_op = 'INSERT' then
    perform private.attach_post_photos(new.author_id, new.id, new.image_paths);
  end if;
  return new;
end; $$;

-- Clients may delete their own post photos only while no live post uses them.
create policy community_media_delete_unreferenced on storage.objects as restrictive for delete to authenticated
  using (not (bucket_id = 'community-media' and (storage.foldername(name))[1] = 'posts' and private.post_photo_in_use(name)));

-- And may not drop the upload record of a photo a live post uses.
create policy media_delete_unreferenced on public.media_attachments as restrictive for delete to authenticated
  using (not (bucket_id = 'community-media' and object_path like 'posts/%' and private.post_photo_in_use(object_path)));

-- ------------------------------------------------------------ publication --
/**
 * Publishes a post exactly once per (author, op_id).
 * Returns {post_id, outcome}: 'created', 'existing' (same payload retried) or
 * 'conflict' (the id was already used for a different payload; nothing new
 * is written). Photos are validated and attached by the posts guard.
 */
create or replace function public.publish_post(
  op_id uuid, post_type text, body text, post_audience text, photos text[],
  lat double precision default null, lng double precision default null, label text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  caller uuid := (select auth.uid());
  nb text;
  existing public.posts;
  new_id uuid;
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if op_id is null then raise exception 'invalid:op_id' using errcode = '22023'; end if;
  -- Serialize retries of the same operation.
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':post:' || op_id::text, 0));
  select * into existing from public.posts where author_id = caller and client_op_id = op_id;
  if existing.id is not null then
    if existing.deleted_at is null and existing.type = post_type and existing.text_ar = coalesce(body, '')
       and existing.audience = post_audience and existing.image_paths = coalesce(photos, '{}')
       and existing.location_label is not distinct from nullif(btrim(label), '') then
      return jsonb_build_object('post_id', existing.id, 'outcome', 'existing');
    end if;
    return jsonb_build_object('post_id', case when existing.deleted_at is null then existing.id end, 'outcome', 'conflict');
  end if;
  select m.neighborhood_id into nb from public.neighborhood_memberships m
  where m.user_id = caller and m.active and m.verification_status = 'verified' limit 1;
  if nb is null then raise exception 'not_verified' using errcode = '42501'; end if;
  if post_type not in ('general', 'announcement', 'recommendation') then
    raise exception 'invalid:type' using errcode = '22023';
  end if;
  insert into public.posts(type, author_id, neighborhood_id, text_ar, image_paths, audience, approx_lat, approx_lng, location_label, client_op_id)
  values (post_type, caller, nb, coalesce(body, ''), coalesce(photos, '{}'), post_audience,
          case when lat is null then null else round(lat::numeric, 3)::double precision end,
          case when lng is null then null else round(lng::numeric, 3)::double precision end,
          nullif(btrim(label), ''), op_id)
  returning id into new_id;
  return jsonb_build_object('post_id', new_id, 'outcome', 'created');
end; $$;

/** Adds a comment exactly once per (author, op_id); same outcomes as publish_post. */
create or replace function public.add_post_comment(op_id uuid, target_post uuid, body text, parent uuid default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  caller uuid := (select auth.uid());
  existing public.post_comments;
  new_id uuid;
begin
  if caller is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if op_id is null then raise exception 'invalid:op_id' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':comment:' || op_id::text, 0));
  select * into existing from public.post_comments where author_id = caller and client_op_id = op_id;
  if existing.id is not null then
    if existing.deleted_at is null and existing.post_id = target_post and existing.body = body
       and existing.parent_id is not distinct from parent then
      return jsonb_build_object('comment_id', existing.id, 'outcome', 'existing');
    end if;
    return jsonb_build_object('comment_id', null, 'outcome', 'conflict');
  end if;
  if not private.can_access_post(target_post) then raise exception 'forbidden' using errcode = '42501'; end if;
  if parent is not null and not exists (select 1 from public.post_comments c where c.id = parent and c.post_id = target_post and c.deleted_at is null) then
    raise exception 'invalid:parent' using errcode = '22023';
  end if;
  insert into public.post_comments(post_id, author_id, body, parent_id, client_op_id)
  values (target_post, caller, body, parent, op_id)
  returning id into new_id;
  return jsonb_build_object('comment_id', new_id, 'outcome', 'created');
end; $$;

-- --------------------------------------------------------------- cleanup --
/**
 * Cleanup job (service role). Claims abandoned uploads and marks them
 * 'deleting' BEFORE any file is removed; a claimed upload can never be
 * published again. Eligible:
 *   - 'staged' uploads older than older_than that no live post references and
 *     that no publication in progress has locked (SKIP LOCKED), and
 *   - 'deleting' uploads whose previous attempt failed (claimed_at null) or
 *     whose job died mid-run (claimed longer than stale_after ago).
 * Then delete the returned files from Storage and call finish_post_photo_cleanup.
 */
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

/**
 * After the Storage delete: drops the records of the files actually deleted.
 * Failed ones stay 'deleting' (never publishable) and become due again at
 * once (claimed_at = null), so the next run retries them. Other runs' claims
 * are never touched.
 */
create or replace function public.finish_post_photo_cleanup(deleted_paths text[], failed_paths text[] default '{}')
returns void language sql security definer set search_path to '' as $$
  delete from public.media_attachments
  where bucket_id = 'community-media' and status = 'deleting' and object_path = any(coalesce(deleted_paths, '{}'));
  update public.media_attachments set claimed_at = null
  where bucket_id = 'community-media' and status = 'deleting' and object_path = any(coalesce(failed_paths, '{}'));
$$;

/** Read-only preview for the job's dry run. */
create or replace function public.count_abandoned_post_photos(older_than interval default interval '24 hours')
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'staged_abandoned', count(*) filter (where a.status = 'staged' and a.created_at < now() - older_than and not private.post_photo_in_use(a.object_path)),
    'deleting', count(*) filter (where a.status = 'deleting'))
  from public.media_attachments a where a.bucket_id = 'community-media' and a.object_path like 'posts/%';
$$;

-- ------------------------------------------------------------------ grants --
revoke all on function private.stage_post_photo() from public, anon;
revoke all on function private.post_photo_in_use(text) from public, anon;
revoke all on function private.attach_post_photos(uuid, uuid, text[]) from public, anon;
grant execute on function private.stage_post_photo(), private.post_photo_in_use(text), private.attach_post_photos(uuid, uuid, text[]) to authenticated;
revoke all on function public.publish_post(uuid, text, text, text, text[], double precision, double precision, text) from public, anon;
revoke all on function public.add_post_comment(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.publish_post(uuid, text, text, text, text[], double precision, double precision, text),
  public.add_post_comment(uuid, uuid, text, uuid) to authenticated;
revoke all on function public.claim_abandoned_post_photos(interval, integer, interval) from public, anon, authenticated;
revoke all on function public.finish_post_photo_cleanup(text[], text[]) from public, anon, authenticated;
revoke all on function public.count_abandoned_post_photos(interval) from public, anon, authenticated;
grant execute on function public.claim_abandoned_post_photos(interval, integer, interval), public.finish_post_photo_cleanup(text[], text[]),
  public.count_abandoned_post_photos(interval) to service_role;
