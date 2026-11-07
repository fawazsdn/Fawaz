-- Website support form (haratna website /support and /contact).
-- Visitors are not signed in, so website tickets live in the existing
-- support_requests table with user_id null plus the contact email they give.
-- They are written only through submit_public_support_request(), a
-- SECURITY DEFINER function that validates input and enforces rate limits
-- in the database, so calling it directly (bypassing the website) gets the
-- same checks. Anonymous visitors cannot read anything back: the existing
-- select policy only shows a ticket to its signed-in owner or to staff.
-- Applied to ckqwziutmqohihrenstz via the Supabase MCP on 2026-11-07.

alter table public.support_requests alter column user_id drop not null;

alter table public.support_requests
  add column if not exists source text not null default 'app' check (source in ('app', 'website')),
  add column if not exists contact_name text check (contact_name is null or char_length(contact_name) <= 100),
  add column if not exists contact_email text check (
    contact_email is null or (char_length(contact_email) <= 254 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column if not exists subject text check (subject is null or char_length(subject) <= 150),
  add column if not exists locale text check (locale is null or locale in ('ar', 'en')),
  add column if not exists reference text not null
    default ('HR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

create unique index if not exists support_requests_reference_key on public.support_requests (reference);

alter table public.support_requests drop constraint if exists support_requests_category_check;
alter table public.support_requests add constraint support_requests_category_check
  check (category in ('account', 'verification', 'bug', 'safety', 'privacy', 'deletion', 'general', 'other'));

alter table public.support_requests drop constraint if exists support_requests_requester_check;
alter table public.support_requests add constraint support_requests_requester_check
  check (user_id is not null or (source = 'website' and contact_email is not null));

create index if not exists support_requests_email_recent_idx
  on public.support_requests (lower(contact_email), created_at desc) where source = 'website';

create or replace function public.submit_public_support_request(
  contact_name text, contact_email text, category text, subject text, message text, locale text)
returns text language plpgsql security definer set search_path to '' as $fn$
declare
  email text := lower(btrim(coalesce(contact_email, '')));
  name text := nullif(btrim(coalesce(contact_name, '')), '');
  subj text := btrim(coalesce(subject, ''));
  body text := btrim(coalesce(message, ''));
  recent int; ref text; staff record;
begin
  if char_length(email) > 254 or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid:email' using errcode = '22023';
  end if;
  if category is null or category not in ('account', 'verification', 'bug', 'safety', 'privacy', 'deletion', 'general', 'other') then
    raise exception 'invalid:category' using errcode = '22023';
  end if;
  if char_length(subj) < 3 or char_length(subj) > 150 then raise exception 'invalid:subject' using errcode = '22023'; end if;
  if char_length(body) < 20 or char_length(body) > 3000 then raise exception 'invalid:message' using errcode = '22023'; end if;
  if name is not null and char_length(name) > 100 then raise exception 'invalid:name' using errcode = '22023'; end if;

  -- Abuse limits, enforced here so they also apply to direct API calls.
  select count(*) into recent from public.support_requests s
  where s.source = 'website' and lower(s.contact_email) = email and s.created_at > now() - interval '1 hour';
  if recent >= 3 then raise exception 'rate_limited' using errcode = '22023'; end if;
  select count(*) into recent from public.support_requests s
  where s.source = 'website' and lower(s.contact_email) = email and s.created_at > now() - interval '24 hours';
  if recent >= 10 then raise exception 'rate_limited' using errcode = '22023'; end if;
  select count(*) into recent from public.support_requests s
  where s.source = 'website' and s.created_at > now() - interval '1 hour';
  if recent >= 200 then raise exception 'rate_limited' using errcode = '22023'; end if;

  insert into public.support_requests(user_id, source, contact_name, contact_email, category, subject, message, locale)
  values (null, 'website', name, email, category, subj, body, case when locale = 'en' then 'en' else 'ar' end)
  returning reference into ref;

  for staff in select p.id from public.profiles p where p.app_role in ('admin', 'moderator') and p.deleted_at is null loop
    perform private.notify(staff.id, null, 'moderation', 'طلب دعم جديد من الموقع', 'New website support request',
      left(subj, 140), left(subj, 140), '/admin/support');
  end loop;
  return ref;
end; $fn$;

revoke all on function public.submit_public_support_request(text, text, text, text, text, text) from public;
grant execute on function public.submit_public_support_request(text, text, text, text, text, text) to anon, authenticated;

-- Website tickets have no app account to notify; staff reply by email.
-- Also fixes the earlier version, whose unqualified `response` was ambiguous
-- with the column of the same name, so every staff reply failed.
create or replace function public.respond_support_request(request uuid, response text, close boolean default false)
returns void language plpgsql security definer set search_path to '' as $fn$
declare r public.support_requests;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into r from public.support_requests where id = request for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  update public.support_requests set response = btrim(respond_support_request.response), responded_by = (select auth.uid()), responded_at = now(),
    status = case when close then 'closed' else 'answered' end
  where id = request;
  if r.user_id is not null then
    perform private.notify(r.user_id, (select auth.uid()), 'moderation', 'رد فريق الدعم', 'Support replied',
      left(btrim(respond_support_request.response), 280), left(btrim(respond_support_request.response), 280), '/settings/support');
  end if;
end; $fn$;
