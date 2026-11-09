-- Prints one line per fact; the drill compares them before rollback and after restore.
select 'follows' as k, count(*)::text as v from public.follows
union all select 'follows_pending', count(*)::text from public.follows where status = 'pending'
union all select 'private_accounts', count(*)::text from public.profiles where is_private
union all select 'audiences', string_agg(id::text || '=' || audience, ',' order by id) from public.posts where id::text like 'b0000000%'
union all select 'avatar_paths', count(*)::text from public.profiles where avatar_path is not null
union all select 'follow_notifications', count(*)::text from public.notifications where type in ('follow','follow_request','follow_accepted')
union all select 'profile_photo_files', count(*)::text from storage.objects where bucket_id = 'profile-photos'
order by 1;
