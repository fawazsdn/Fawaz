-- Rollback for 20261110090000_social_resilience.sql (run before the 130000
-- and 120000 rollbacks). Requires owner approval.
-- Data: posts, comments and photos are untouched. Only the operation ids
-- (client_op_id) and the upload status column are dropped; nothing in Storage
-- is deleted. Uploads that were 'staged' simply become ordinary records again.
begin;
drop policy if exists community_media_delete_unreferenced on storage.objects;
drop policy if exists media_delete_unreferenced on public.media_attachments;
drop trigger if exists media_attachments_stage_post_photo on public.media_attachments;
drop function if exists public.publish_post(uuid, text, text, text, text[], double precision, double precision, text);
drop function if exists public.add_post_comment(uuid, uuid, text, uuid);
drop function if exists public.claim_abandoned_post_photos(interval, integer, interval);
drop function if exists public.count_abandoned_post_photos(interval);
drop function if exists public.finish_post_photo_cleanup(text[], text[]);

-- Restore the posts guard of 20261109120000 (without photo attachment).
create or replace function private.guard_post_write()
returns trigger language plpgsql security invoker set search_path to '' as $$
declare
  path text;
  parts text[];
  staff boolean := private.is_admin_or_moderator();
  client boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'UPDATE' and client and not staff then
    if (new.author_id, new.neighborhood_id, new.type, new.created_at, new.linked_entity_type, new.linked_entity_id, new.pinned)
       is distinct from (old.author_id, old.neighborhood_id, old.type, old.created_at, old.linked_entity_type, old.linked_entity_id, old.pinned) then
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
      -- Photos in the neighborhood folder are readable by every verified member,
      -- so they may only appear on neighborhood-audience posts.
      if new.audience in ('public', 'followers') and parts[1] <> 'posts' then
        raise exception 'invalid:audience' using errcode = '22023';
      end if;
    end loop;
  end if;
  return new;
end; $$;

drop function if exists private.attach_post_photos(uuid, uuid, text[]);
drop function if exists private.post_photo_in_use(text);
drop function if exists private.stage_post_photo();
drop index if exists public.media_attachments_staged_idx;
drop index if exists public.media_attachments_deleting_idx;
alter table public.media_attachments drop column if exists claimed_at;
alter table public.media_attachments drop constraint if exists media_attachments_status_check;
alter table public.media_attachments drop column if exists status;
drop index if exists public.posts_author_client_op_idx;
drop index if exists public.post_comments_author_client_op_idx;
alter table public.posts drop column if exists client_op_id;
alter table public.post_comments drop column if exists client_op_id;
commit;
