-- Read-only Explore API. The caller's existing RLS applies to every joined table.
create function public.explore_social_feed(
  feed text, page_offset integer default 0, search_text text default null
)
returns setof jsonb
language sql stable security invoker set search_path = ''
begin atomic
  with viewer as (
    select m.user_id, m.neighborhood_id, n.city_id, n.center_lat, n.center_lng
    from public.neighborhood_memberships m
    join public.neighborhoods n on n.id = m.neighborhood_id
    where m.user_id = (select auth.uid()) and m.active and m.verification_status = 'verified'
  ),
  candidates as (
    select p.id, p.author_id, p.neighborhood_id, p.type, p.audience, p.created_at,
      p.text_ar, p.text_en, p.image_paths, p.linked_entity_id,
      p.neighborhood_id = v.neighborhood_id as local_post,
      v.user_id as viewer_id
    from viewer v
    join public.posts p on p.deleted_at is null
    join public.profiles author on author.id = p.author_id and author.deleted_at is null
    join public.neighborhoods area on area.id = p.neighborhood_id
    left join public.follows f on f.follower_id = v.user_id
      and f.followee_id = p.author_id and f.status = 'accepted'
    where (search_text is null or (
        length(btrim(search_text)) between 1 and 120 and
        (strpos(lower(p.text_ar), lower(btrim(search_text))) > 0
         or strpos(lower(p.text_en), lower(btrim(search_text))) > 0)
      ))
      and not private.is_blocked_between(v.user_id, p.author_id)
      and case feed
        when 'friends' then f.followee_id is not null
        when 'community' then
          (not author.is_private or p.author_id = v.user_id)
          and p.audience <> 'followers'
          and p.created_at >= now() - interval '90 days'
          and (p.neighborhood_id = v.neighborhood_id or (
            p.audience = 'public' and area.city_id = v.city_id
            and 6371 * acos(least(1, greatest(-1,
              sin(radians(v.center_lat)) * sin(radians(area.center_lat))
              + cos(radians(v.center_lat)) * cos(radians(area.center_lat))
              * cos(radians(area.center_lng - v.center_lng))
            ))) <= 25
          ))
        else false
      end
  ),
  scored as (
    select c.*,
      (select count(*) from public.post_comments cm where cm.post_id = c.id and cm.deleted_at is null) as comments,
      (select coalesce(jsonb_agg(jsonb_build_object('user_id', r.user_id, 'type', r.type)), '[]')
       from public.post_reactions r where r.post_id = c.id and not private.is_blocked_between(c.viewer_id, r.user_id)) as reactions
    from candidates c
  )
  select (to_jsonb(s) - array['comments', 'reactions', 'local_post', 'viewer_id'])
    || jsonb_build_object(
      'post_comments', jsonb_build_array(jsonb_build_object('count', s.comments)),
      'post_reactions', s.reactions,
      'saved', exists (select 1 from public.saved_posts sp where sp.post_id = s.id and sp.user_id = s.viewer_id)
    )
  from scored s
  order by
    case when feed = 'community' then s.local_post end desc,
    case when feed = 'community' then
      extract(epoch from s.created_at) + 1800 * least(48, s.comments * 2 + jsonb_array_length(s.reactions))
    end desc,
    s.created_at desc, s.id desc
  limit 16 offset greatest(0, least(coalesce(page_offset, 0), 10000));
end;

revoke execute on function public.explore_social_feed(text, integer, text) from public, anon;
grant execute on function public.explore_social_feed(text, integer, text) to authenticated;

-- The existing recipient policy still applies. Gate social notification
-- previews on current actor/post visibility, including old notifications.
create policy notifications_social_visibility on public.notifications
as restrictive for select to authenticated
using (
  (actor_id is null or not private.is_blocked_between((select auth.uid()), actor_id))
  and case
    when split_part(deep_link, '?', 1) ~ '^/post/[0-9a-fA-F-]{36}$' then
      exists (select 1 from public.posts p where '/post/' || p.id = split_part(notifications.deep_link, '?', 1)
        and p.deleted_at is null and not private.is_blocked_between((select auth.uid()), p.author_id))
    when deep_link like '/post/%' then false
    else true
  end
);
