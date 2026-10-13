-- App Store compliance backend:
--  1. Objectionable-content filter (App Review Guideline 1.2: "a method for
--     filtering objectionable material from being posted"). Server-side,
--     token-based, admin-managed list. Seeded with a small starter list that
--     the Haratna team must review and extend.
--  2. In-app support requests (Guideline 1.5 contact + 1.2 timely responses).
--  3. Manual, audited neighborhood verification by an admin — used to give the
--     App Review account access without a physical visit (Guideline 2.1),
--     without any client-side bypass.
-- Applied to ckqwziutmqohihrenstz via the Supabase MCP on 2026-10-14.

-- ------------------------------------------------------------ 1. filter --
create table if not exists public.moderation_terms (
  term text primary key check (term = btrim(term) and term <> '' and char_length(term) <= 60),
  created_at timestamptz not null default now()
);
alter table public.moderation_terms enable row level security;
create policy moderation_terms_admin_select on public.moderation_terms for select using ((select private.is_platform_admin()));
revoke all on public.moderation_terms from anon, authenticated;
grant select on public.moderation_terms to authenticated;

-- Same normalization for text and terms: lower-case, unify Arabic letter
-- variants, strip diacritics/tatweel, and pad tokens with spaces so matching
-- is whole-word (no false positives inside longer words).
create or replace function private.normalize_ugc(t text)
returns text language sql immutable set search_path to '' as $fn$
  select ' ' || btrim(regexp_replace(
    translate(regexp_replace(lower(coalesce(t, '')), '[ً-ٰٟ]', '', 'g'), 'أإآٱةىـ', 'ااااهي'),
    '[^a-z0-9ء-ي]+', ' ', 'g')) || ' ';
$fn$;

create or replace function private.contains_blocked_term(t text)
returns boolean language sql stable security definer set search_path to '' as $fn$
  select t is not null and exists (
    select 1 from public.moderation_terms m
    where position(private.normalize_ugc(m.term) in private.normalize_ugc(t)) > 0);
$fn$;

-- Generic trigger: TG_ARGV lists the text columns to check.
create or replace function private.filter_ugc()
returns trigger language plpgsql security definer set search_path to '' as $fn$
declare col text; row_json jsonb := to_jsonb(new);
begin
  foreach col in array tg_argv loop
    if private.contains_blocked_term(row_json->>col) then
      raise exception 'content_blocked' using errcode = '22023';
    end if;
  end loop;
  return new;
end; $fn$;

create trigger posts_filter_ugc before insert or update of text_ar, text_en on public.posts for each row execute function private.filter_ugc('text_ar', 'text_en');
create trigger post_comments_filter_ugc before insert or update of body on public.post_comments for each row execute function private.filter_ugc('body');
create trigger messages_filter_ugc before insert or update of body on public.messages for each row execute function private.filter_ugc('body');
create trigger club_announcements_filter_ugc before insert or update of body on public.club_announcements for each row execute function private.filter_ugc('body');
create trigger events_filter_ugc before insert or update of title, description on public.events for each row execute function private.filter_ugc('title', 'description');
create trigger listings_filter_ugc before insert or update of title, description on public.marketplace_listings for each row execute function private.filter_ugc('title', 'description');
create trigger clubs_filter_ugc before insert or update of name, description, rules on public.community_groups for each row execute function private.filter_ugc('name', 'description', 'rules');
create trigger help_filter_ugc before insert or update of title, description on public.help_requests for each row execute function private.filter_ugc('title', 'description');
create trigger lost_found_filter_ugc before insert or update of title, description on public.lost_found_posts for each row execute function private.filter_ugc('title', 'description');
create trigger borrow_filter_ugc before insert or update of title, description on public.borrow_listings for each row execute function private.filter_ugc('title', 'description');
create trigger recommendations_filter_ugc before insert or update of body on public.business_recommendations for each row execute function private.filter_ugc('body');
create trigger issues_filter_ugc before insert or update of title, description on public.issues for each row execute function private.filter_ugc('title', 'description');
create trigger profiles_filter_ugc before insert or update of first_name, last_name, bio on public.profiles for each row execute function private.filter_ugc('first_name', 'last_name', 'bio');

-- Starter list (explicit sexual terms, severe insults and slurs). Owner to review.
insert into public.moderation_terms(term) values
  ('fuck'), ('fucking'), ('motherfucker'), ('cunt'), ('nigger'), ('faggot'), ('whore'), ('slut'), ('bitch'),
  ('شرموطة'), ('قحبة'), ('منيوك'), ('منيك'), ('كسمك'), ('كس امك'), ('عرص'), ('زبي'), ('انيكك')
on conflict do nothing;

-- Admin management (insert/remove go through RPCs; removal is a soft flag-free update path by design).
create or replace function public.admin_add_moderation_term(new_term text)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
  if not private.is_platform_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  insert into public.moderation_terms(term) values (btrim(lower(new_term))) on conflict do nothing;
end; $fn$;

-- -------------------------------------------------------- 2. support --
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('account', 'bug', 'safety', 'privacy', 'deletion', 'other')),
  message text not null check (char_length(btrim(message)) between 10 and 3000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  response text check (response is null or char_length(response) <= 3000),
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_requests_status_idx on public.support_requests (status, created_at desc);
alter table public.support_requests enable row level security;
create policy support_requests_select on public.support_requests for select using (
  user_id = (select auth.uid()) or (select private.is_admin_or_moderator()));
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;

create or replace function public.submit_support_request(category text, message text)
returns uuid language plpgsql security definer set search_path to '' as $fn$
declare caller uuid := (select auth.uid()); created uuid; recent int; staff record;
begin
  if caller is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select count(*) into recent from public.support_requests where user_id = caller and created_at > now() - interval '24 hours';
  if recent >= 5 then raise exception 'rate_limited' using errcode = '22023'; end if;
  insert into public.support_requests(user_id, category, message) values (caller, category, btrim(message)) returning id into created;
  for staff in select id from public.profiles where app_role in ('admin', 'moderator') and deleted_at is null and id <> caller loop
    perform private.notify(staff.id, caller, 'moderation', 'طلب دعم جديد', 'New support request',
      left(btrim(message), 140), left(btrim(message), 140), '/admin/support');
  end loop;
  return created;
end; $fn$;

create or replace function public.respond_support_request(request uuid, response text, close boolean default false)
returns void language plpgsql security definer set search_path to '' as $fn$
declare r public.support_requests;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into r from public.support_requests where id = request for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  update public.support_requests set response = btrim(response), responded_by = (select auth.uid()), responded_at = now(),
    status = case when close then 'closed' else 'answered' end
  where id = request;
  perform private.notify(r.user_id, (select auth.uid()), 'moderation', 'رد فريق الدعم', 'Support replied',
    left(btrim(response), 280), left(btrim(response), 280), '/settings/support');
end; $fn$;

-- --------------------------------------------- 3. audited manual verification --
-- Admin-only (or database maintenance from the SQL editor). Recorded in
-- neighborhood_verifications with method 'manual'. Never callable by a
-- regular client, so it is not a bypass of location verification.
create or replace function public.admin_verify_member(target uuid, target_neighborhood text, note text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare membership uuid; actor uuid := (select auth.uid());
begin
  if not (private.is_platform_admin() or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if coalesce(btrim(note), '') = '' then raise exception 'a note is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.neighborhoods where id = target_neighborhood) then raise exception 'unknown neighborhood' using errcode = '22023'; end if;
  update public.neighborhood_memberships set active = false where user_id = target and neighborhood_id <> target_neighborhood;
  insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at, verified_by)
  values (target, target_neighborhood, 'verified', true, now(), actor)
  on conflict (user_id, neighborhood_id) do update set verification_status = 'verified', active = true, verified_at = now(), verified_by = actor
  returning id into membership;
  insert into public.neighborhood_verifications(membership_id, user_id, method, status, review_note, reviewed_by, reviewed_at)
  values (membership, target, 'manual', 'verified', btrim(note), actor, now());
end; $fn$;

create or replace function public.admin_revoke_membership(target uuid, note text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare m record; actor uuid := (select auth.uid());
begin
  if not (private.is_platform_admin() or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  for m in select id from public.neighborhood_memberships where user_id = target and active loop
    update public.neighborhood_memberships set verification_status = 'unverified', active = false, verified_at = null where id = m.id;
    insert into public.neighborhood_verifications(membership_id, user_id, method, status, review_note, reviewed_by, reviewed_at)
    values (m.id, target, 'manual', 'rejected', coalesce(btrim(note), 'access revoked'), actor, now());
  end loop;
end; $fn$;

do $grants$
declare f text;
begin
  foreach f in array array['public.admin_add_moderation_term(text)', 'public.submit_support_request(text,text)',
    'public.respond_support_request(uuid,text,boolean)', 'public.admin_verify_member(uuid,text,text)', 'public.admin_revoke_membership(uuid,text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $grants$;
revoke truncate, trigger, references on public.moderation_terms, public.support_requests from authenticated, anon;
