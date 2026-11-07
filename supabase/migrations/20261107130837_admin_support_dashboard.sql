-- Admin dashboard for support requests (web/ /admin).
-- Applied to ckqwziutmqohihrenstz via the Supabase MCP on 2026-11-07.
-- Backward compatible: new nullable columns and staff-only functions; the
-- existing respond_support_request(uuid, text, boolean) signature used by the
-- mobile app is unchanged. Every function is SECURITY DEFINER (residents have
-- no access to the private schema that holds the role helpers) and starts with
-- an explicit private.is_admin_or_moderator() check, so non-staff callers get
-- 'not_authorized' before any data is read. Execute is revoked from anon.
-- (Applied as two migrations: admin_support_dashboard, then
-- admin_support_dashboard_definer switched the four readers to DEFINER.)

-- ------------------------------------------------------------- columns --
alter table public.support_requests
  add column if not exists first_responded_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists email_status text check (email_status is null or email_status in
    ('pending', 'sending', 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed')),
  add column if not exists email_message_id text,
  add column if not exists email_attempts int not null default 0,
  add column if not exists email_last_error text check (email_last_error is null or char_length(email_last_error) <= 500),
  add column if not exists email_last_attempt_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_status_at timestamptz,
  add column if not exists email_response_hash text;

-- Best available history for rows answered before this column existed.
update public.support_requests set first_responded_at = responded_at where first_responded_at is null and responded_at is not null;
update public.support_requests set closed_at = coalesce(responded_at, created_at) where closed_at is null and status = 'closed';

create index if not exists support_requests_created_idx on public.support_requests (created_at desc);

-- --------------------------------------------------- respond (unchanged API) --
-- Same behaviour as before, plus: first response time, closed_at, and a fresh
-- "pending" email state for website tickets whenever the response text changes.
create or replace function public.respond_support_request(request uuid, response text, close boolean default false)
returns void language plpgsql security definer set search_path to '' as $fn$
declare r public.support_requests; body text := btrim(coalesce(respond_support_request.response, ''));
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if body = '' or char_length(body) > 3000 then raise exception 'invalid:response' using errcode = '22023'; end if;
  select * into r from public.support_requests s where s.id = request for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  update public.support_requests s set
    response = body,
    responded_by = (select auth.uid()),
    responded_at = now(),
    first_responded_at = coalesce(s.first_responded_at, now()),
    status = case when close then 'closed' else 'answered' end,
    closed_at = case when close then now() else null end,
    status_changed_by = (select auth.uid()),
    email_status = case
      when s.source <> 'website' then null
      when s.email_response_hash = md5(body) and s.email_status in ('sent', 'delivered') then s.email_status
      else 'pending' end
  where s.id = request;
  if r.user_id is not null then
    perform private.notify(r.user_id, (select auth.uid()), 'moderation', 'رد فريق الدعم', 'Support replied',
      left(body, 280), left(body, 280), '/settings/support');
  end if;
end; $fn$;

-- ----------------------------------------------------------- status --
-- open (reopen), answered (only with a response), closed.
create or replace function public.set_support_request_status(request uuid, new_status text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare r public.support_requests;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if new_status not in ('open', 'answered', 'closed') then raise exception 'invalid:status' using errcode = '22023'; end if;
  select * into r from public.support_requests s where s.id = request for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if new_status = 'answered' and r.response is null then raise exception 'invalid:no_response' using errcode = '22023'; end if;
  update public.support_requests s set
    status = new_status,
    closed_at = case when new_status = 'closed' then coalesce(s.closed_at, now()) else null end,
    status_changed_by = (select auth.uid())
  where s.id = request;
end; $fn$;

-- ------------------------------------------------------------ email --
-- Claim the right to send the reply email. Atomic, so two clicks (or two
-- admins) cannot send the same reply twice; a reply already accepted by the
-- provider is never re-sent; at most 5 attempts per hour.
create or replace function public.claim_support_reply_email(request uuid)
returns table (contact_email text, contact_name text, reference text, subject text, locale text, response text, response_hash text, attempt int)
language plpgsql security definer set search_path to '' as $fn$
declare r public.support_requests; h text;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into r from public.support_requests s where s.id = request for update;
  if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if r.source <> 'website' or r.contact_email is null then raise exception 'email:not_applicable' using errcode = '22023'; end if;
  if r.response is null then raise exception 'email:no_response' using errcode = '22023'; end if;
  h := md5(r.response);
  if r.email_response_hash = h and r.email_status in ('sent', 'delivered', 'delivery_delayed') then
    raise exception 'email:already_sent' using errcode = '22023';
  end if;
  if r.email_status = 'sending' and r.email_last_attempt_at > now() - interval '2 minutes' then
    raise exception 'email:in_progress' using errcode = '22023';
  end if;
  if r.email_attempts >= 5 and r.email_last_attempt_at > now() - interval '1 hour' then
    raise exception 'email:too_many_attempts' using errcode = '22023';
  end if;
  update public.support_requests s set
    email_status = 'sending',
    email_attempts = case when s.email_last_attempt_at > now() - interval '1 hour' then s.email_attempts + 1 else 1 end,
    email_last_attempt_at = now(),
    email_response_hash = h
  where s.id = request
  returning s.email_attempts into attempt;
  return query select r.contact_email, r.contact_name, r.reference, r.subject, r.locale, r.response, h, attempt;
end; $fn$;

-- Record what the provider answered for a claimed send.
create or replace function public.record_support_reply_email(request uuid, response_hash text, accepted boolean, message_id text, error text)
returns void language plpgsql security definer set search_path to '' as $fn$
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.support_requests s set
    email_status = case when accepted then 'sent' else 'failed' end,
    email_message_id = case when accepted then left(record_support_reply_email.message_id, 200) else s.email_message_id end,
    email_sent_at = case when accepted then now() else s.email_sent_at end,
    email_status_at = now(),
    email_last_error = case when accepted then null else left(coalesce(record_support_reply_email.error, 'unknown error'), 500) end
  where s.id = request and s.email_status = 'sending' and s.email_response_hash = record_support_reply_email.response_hash;
  if not found then raise exception 'email:not_claimed' using errcode = '22023'; end if;
end; $fn$;

-- Store the provider-reported delivery state (looked up with the provider's API).
create or replace function public.update_support_reply_email_status(request uuid, message_id text, provider_status text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare mapped text;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  mapped := case provider_status
    when 'delivered' then 'delivered' when 'bounced' then 'bounced' when 'complained' then 'complained'
    when 'delivery_delayed' then 'delivery_delayed' when 'failed' then 'failed' when 'canceled' then 'failed'
    else 'sent' end;
  update public.support_requests s set email_status = mapped, email_status_at = now()
  where s.id = request and s.email_message_id = update_support_reply_email_status.message_id
    and s.email_status in ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed');
end; $fn$;

-- ---------------------------------------------------------- reading --
-- Ticket list with filters, search and paging (LIKE wildcards in the query are escaped).
create or replace function public.admin_list_support_requests(
  p_status text default null, p_source text default null, p_category text default null,
  p_from timestamptz default null, p_to timestamptz default null, p_query text default null,
  p_customer text default null, p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare q text := nullif(btrim(coalesce(p_query, '')), ''); pattern text; result jsonb;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if q is not null then
    pattern := '%' || replace(replace(replace(left(q, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  with filtered as (
    select s.* from public.support_requests s
    where (p_status is null or s.status = p_status)
      and (p_source is null or s.source = p_source)
      and (p_category is null or s.category = p_category)
      and (p_from is null or s.created_at >= p_from)
      and (p_to is null or s.created_at < p_to)
      and (p_customer is null or lower(s.contact_email) = lower(p_customer) or s.user_id::text = p_customer)
      and (pattern is null or s.reference ilike pattern or s.contact_email ilike pattern or s.message ilike pattern
           or s.subject ilike pattern or s.contact_name ilike pattern)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(row_to_json(t) order by t.created_at desc) from (
      select f.id, f.reference, f.source, f.category, f.status, f.subject, left(f.message, 240) as message_preview,
             f.contact_name, f.contact_email, f.user_id, f.created_at, f.responded_at, f.email_status,
             nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') as app_user_name
      from filtered f left join public.profiles p on p.id = f.user_id
      order by f.created_at desc
      limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) t), '[]'::jsonb))
  into result;
  return result;
end; $fn$;

-- One ticket with names of the customer (app tickets) and the responding staff member.
create or replace function public.admin_get_support_request(request uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare result jsonb;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select to_jsonb(s) || jsonb_build_object(
      'app_user_name', nullif(btrim(concat_ws(' ', u.first_name, u.last_name)), ''),
      'responder_name', nullif(btrim(concat_ws(' ', r.first_name, r.last_name)), ''),
      'status_changed_by_name', nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''))
  into result
  from public.support_requests s
  left join public.profiles u on u.id = s.user_id
  left join public.profiles r on r.id = s.responded_by
  left join public.profiles c on c.id = s.status_changed_by
  where s.id = request;
  return result;
end; $fn$;

-- Live statistics for the overview and analytics pages, in the given time zone.
create or replace function public.admin_support_overview(p_tz text default 'Asia/Riyadh', p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare tz text := case when p_tz in (select name from pg_catalog.pg_timezone_names) then p_tz else 'Asia/Riyadh' end;
  days int := least(greatest(coalesce(p_days, 30), 7), 365);
  today date := (now() at time zone tz)::date; result jsonb;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total', count(*),
    'open', count(*) filter (where s.status = 'open'),
    'answered', count(*) filter (where s.status = 'answered'),
    'closed', count(*) filter (where s.status = 'closed'),
    'today', count(*) filter (where (s.created_at at time zone tz)::date = today),
    'week', count(*) filter (where (s.created_at at time zone tz)::date > today - 7),
    'month', count(*) filter (where (s.created_at at time zone tz)::date > today - 30),
    'website', count(*) filter (where s.source = 'website'),
    'app', count(*) filter (where s.source = 'app'),
    'responded', count(*) filter (where s.first_responded_at is not null),
    'avg_first_response_seconds', round(extract(epoch from avg(s.first_responded_at - s.created_at) filter (where s.first_responded_at is not null))),
    'median_first_response_seconds', round(extract(epoch from percentile_cont(0.5) within group (order by (s.first_responded_at - s.created_at))
                                        filter (where s.first_responded_at is not null))),
    'by_category', coalesce((select jsonb_object_agg(x.category, x.n) from (select s2.category, count(*) n from public.support_requests s2 group by 1) x), '{}'::jsonb),
    'emails_failed', count(*) filter (where s.email_status in ('failed', 'bounced', 'complained')),
    'series', (select jsonb_agg(jsonb_build_object('day', d::date, 'count', (
                  select count(*) from public.support_requests s3 where (s3.created_at at time zone tz)::date = d::date)) order by d)
               from generate_series(today - (days - 1), today, interval '1 day') d),
    'time_zone', tz, 'days', days)
  into result from public.support_requests s;
  return result;
end; $fn$;

-- Customers derived from tickets: website senders by email, app users by account.
create or replace function public.admin_support_customers(p_query text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path to '' as $fn$
declare q text := nullif(btrim(coalesce(p_query, '')), ''); pattern text; result jsonb;
begin
  if not private.is_admin_or_moderator() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if q is not null then
    pattern := '%' || replace(replace(replace(left(q, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  with tickets as (
    select coalesce(lower(s.contact_email), s.user_id::text) as customer_key, s.*,
           nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') as app_user_name
    from public.support_requests s left join public.profiles p on p.id = s.user_id
  ), grouped as (
    select t.customer_key,
           (array_agg(t.source order by t.created_at desc))[1] as source,
           max(t.contact_email) as email,
           coalesce(max(t.app_user_name), (array_agg(t.contact_name order by t.created_at desc) filter (where t.contact_name is not null))[1]) as name,
           count(*) as tickets, count(*) filter (where t.status = 'open') as open_tickets,
           min(t.created_at) as first_at, max(t.created_at) as last_at
    from tickets t group by t.customer_key
  ), filtered as (
    select g.* from grouped g where pattern is null or g.email ilike pattern or g.name ilike pattern
  )
  select jsonb_build_object('total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(row_to_json(f) order by f.last_at desc) from (
       select * from filtered order by last_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)) f), '[]'::jsonb))
  into result;
  return result;
end; $fn$;

-- ----------------------------------------------------------- grants --
do $grants$
declare f text;
begin
  foreach f in array array[
    'public.set_support_request_status(uuid,text)', 'public.claim_support_reply_email(uuid)',
    'public.record_support_reply_email(uuid,text,boolean,text,text)', 'public.update_support_reply_email_status(uuid,text,text)',
    'public.admin_list_support_requests(text,text,text,timestamptz,timestamptz,text,text,int,int)',
    'public.admin_get_support_request(uuid)', 'public.admin_support_overview(text,int)', 'public.admin_support_customers(text,int,int)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $grants$;
