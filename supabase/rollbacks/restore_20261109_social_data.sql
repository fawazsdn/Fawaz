-- Restores the social data saved by the 20261109120000 rollback, after the
-- migrations have been re-applied. Safe to run once; skips rows that no longer
-- make sense (deleted accounts or posts, blocks created in the meantime).
-- Only the latest rollback is restored: the archive tables keep every earlier
-- rollback too (each rollback is one transaction, so its rows share one saved_at),
-- and an older one would bring back follows, privacy or notifications that were
-- changed since. Found in the staging drill (2026-11-16).
begin;
insert into public.follows(follower_id, followee_id, status, created_at, accepted_at)
select f.follower_id, f.followee_id, f.status, f.created_at, f.accepted_at
from private.rollback_20261109_follows f
where f.saved_at = (select max(saved_at) from private.rollback_20261109_follows)
  and exists (select 1 from public.profiles p where p.id = f.follower_id and p.deleted_at is null)
  and exists (select 1 from public.profiles p where p.id = f.followee_id and p.deleted_at is null)
  and not private.is_blocked_between(f.follower_id, f.followee_id)
on conflict do nothing;
-- Restoring privacy re-runs the profile triggers (public links are archived again).
update public.profiles p set is_private = true
from private.rollback_20261109_privacy r where r.user_id = p.id
  and r.saved_at = (select max(saved_at) from private.rollback_20261109_privacy) and p.deleted_at is null;
update public.posts p set audience = a.audience
from private.rollback_20261109_post_audiences a
where a.post_id = p.id and p.deleted_at is null
  and a.saved_at = (select max(saved_at) from private.rollback_20261109_post_audiences) and p.audience = 'neighborhood'
  and not exists (select 1 from unnest(p.image_paths) x where x not like 'posts/%');
insert into public.notifications(id, user_id, actor_id, type, title_ar, title_en, body_ar, body_en, deep_link, read_at, created_at)
select n.id, n.user_id, n.actor_id, n.type, n.title_ar, n.title_en, n.body_ar, n.body_en, n.deep_link, n.read_at, n.created_at
from private.rollback_20261109_notifications n
where n.saved_at = (select max(saved_at) from private.rollback_20261109_notifications)
  and exists (select 1 from public.profiles p where p.id = n.user_id)
on conflict (id) do nothing;
-- Profile photo paths saved by the 20261109130000 rollback (only where the
-- private file is still in place and nothing newer was set).
update public.profiles p set avatar_path = a.avatar_path
from (select user_id, avatar_path from private.rollback_20261109_avatar_paths
      where saved_at = (select max(saved_at) from private.rollback_20261109_avatar_paths)) a
where a.user_id = p.id and p.avatar_path is null and p.deleted_at is null
  and exists (select 1 from storage.objects o where o.bucket_id = 'profile-photos' and o.name = a.avatar_path);
commit;
