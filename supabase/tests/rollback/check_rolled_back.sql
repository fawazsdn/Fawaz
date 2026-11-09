-- While rolled back: nothing became more visible, nothing was lost.
select 'audiences_while_rolled_back' as k, string_agg(id::text || '=' || audience, ',' order by id) as v from public.posts where id::text like 'b0000000%'
union all select 'saved_follows', count(*)::text from private.rollback_20261109_follows
union all select 'saved_private', count(*)::text from private.rollback_20261109_privacy
union all select 'saved_audiences', count(*)::text from private.rollback_20261109_post_audiences
union all select 'saved_notifications', count(*)::text from private.rollback_20261109_notifications
union all select 'saved_avatar_paths', count(*)::text from private.rollback_20261109_avatar_paths
union all select 'r2_public_link_restored', count(*)::text from public.profiles where id = 'a0000000-0000-0000-0000-000000000002' and avatar_url like '%/two.jpg'
union all select 'profile_photo_files_kept', count(*)::text from storage.objects where bucket_id = 'profile-photos'
order by 1;
