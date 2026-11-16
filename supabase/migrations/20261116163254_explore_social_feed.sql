-- Read-only Explore API. The caller's existing RLS applies to every joined table.
-- Keyset pagination: the first page fixes a snapshot time (as_of). Later pages pass the
-- feed_cursor of the last row they received. Posts created after as_of, and likes or comments
-- added after it, are left out, so ranks can't move up past the cursor and nothing is skipped.
-- Author fields come from the caller's RLS-visible profile row, with the last name masked by
-- the author's name_privacy setting; the photo path appears only if the caller may see it.
create function public.explore_social_feed(
  feed text, cursor jsonb default null, search_text text default null
)
returns setof jsonb
language sql stable security invoker set search_path = ''
begin atomic
  with params as (
    select least(coalesce((cursor ->> 'as_of')::timestamptz, now()), now()) as as_of,
      (cursor ->> 'local')::integer as c_local, (cursor ->> 'score')::bigint as c_score,
      (cursor ->> 'created_at')::timestamptz as c_created, (cursor ->> 'id')::uuid as c_id
  ),
  viewer as (
    select m.user_id, m.neighborhood_id, n.city_id, n.center_lat, n.center_lng
    from public.neighborhood_memberships m
    join public.neighborhoods n on n.id = m.neighborhood_id
    where m.user_id = (select auth.uid()) and m.active and m.verification_status = 'verified'
  ),
  candidates as (
    select p.id, p.author_id, p.neighborhood_id, p.type, p.audience, p.created_at,
      p.text_ar, p.text_en, p.image_paths, p.linked_entity_id,
      v.user_id as viewer_id, k.as_of,
      case when feed = 'community' and p.neighborhood_id = v.neighborhood_id then 1 else 0 end as sort_local,
      jsonb_build_object('id', author.id, 'first_name', author.first_name,
        'last_name', private.masked_last_name(author.last_name, author.name_privacy),
        'name_privacy', author.name_privacy,
        'avatar_path', case when private.can_view_profile_photo(author.id) then author.avatar_path end) as author,
      jsonb_build_object('id', area.id, 'name_ar', area.name_ar, 'name_en', area.name_en) as area
    from params k
    cross join viewer v
    join public.posts p on p.deleted_at is null and p.created_at <= k.as_of
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
          and p.created_at >= k.as_of - interval '90 days'
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
  counted as (
    select c.*,
      (select count(*) from public.post_comments cm where cm.post_id = c.id and cm.deleted_at is null
        and cm.created_at <= c.as_of and not private.is_blocked_between(c.viewer_id, cm.author_id)) as comments,
      (select coalesce(jsonb_agg(jsonb_build_object('user_id', r.user_id, 'type', r.type)), '[]')
       from public.post_reactions r where r.post_id = c.id and not private.is_blocked_between(c.viewer_id, r.user_id)) as reactions,
      (select count(*) from public.post_reactions r where r.post_id = c.id and r.created_at <= c.as_of
        and not private.is_blocked_between(c.viewer_id, r.user_id)) as reactions_then
    from candidates c
  ),
  scored as (
    select c.*,
      case when feed = 'community'
        then floor(extract(epoch from c.created_at))::bigint + 1800 * least(48, c.comments * 2 + c.reactions_then)
        else 0 end as sort_score
    from counted c
  )
  select (to_jsonb(s) - array['comments', 'reactions', 'reactions_then', 'viewer_id', 'as_of', 'sort_local', 'sort_score'])
    || jsonb_build_object(
      'post_comments', jsonb_build_array(jsonb_build_object('count', s.comments)),
      'post_reactions', s.reactions,
      'saved', exists (select 1 from public.saved_posts sp where sp.post_id = s.id and sp.user_id = s.viewer_id),
      'feed_cursor', jsonb_build_object('as_of', s.as_of, 'local', s.sort_local, 'score', s.sort_score,
        'created_at', s.created_at, 'id', s.id)
    )
  from scored s, params k
  where k.c_id is null
    or (s.sort_local, s.sort_score, s.created_at, s.id) < (k.c_local, k.c_score, k.c_created, k.c_id)
  order by s.sort_local desc, s.sort_score desc, s.created_at desc, s.id desc
  limit 16;
end;

revoke execute on function public.explore_social_feed(text, jsonb, text) from public, anon;
grant execute on function public.explore_social_feed(text, jsonb, text) to authenticated;

-- The existing recipient policy still applies. Gate social notification
-- previews on current actor/post visibility, including old notifications.
create policy notifications_social_visibility on public.notifications
as restrictive for select to authenticated
using (
  (actor_id is null or not private.is_blocked_between((select auth.uid()), actor_id))
  and case
    when deep_link ~ '^/post/[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}([?#].*)?$' then
      exists (select 1 from public.posts p where p.id = substring(notifications.deep_link from 7 for 36)::uuid
        and p.deleted_at is null and not private.is_blocked_between((select auth.uid()), p.author_id))
    when deep_link like '/post/%' then false
    else true
  end
);
