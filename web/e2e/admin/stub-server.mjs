// Test double for Supabase Auth + PostgREST and the Resend API, used only by
// the admin end-to-end tests (playwright.admin.config.ts). It lets the real
// production build of the dashboard run full flows (sign-in with PKCE,
// staff-only data, replies, email failure/retry) without touching production.
// The real database functions are covered by supabase/tests/admin_support.sql.
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 54329);
const b64url = (b) => Buffer.from(b).toString('base64url');

const users = {
  admin: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@haratna.test',
    first_name: 'Fawaz',
    last_name: 'Admin',
    app_role: 'admin',
  },
  resident: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'resident@haratna.test',
    first_name: 'Rami',
    last_name: 'Resident',
    app_role: 'user',
  },
};
const byEmail = (e) => Object.values(users).find((u) => u.email === e);
const byId = (id) => Object.values(users).find((u) => u.id === id);

let tickets = [];
let resendMode = 'ok';
const resendSent = new Map(); // idempotency key -> id
const resendCalls = [];
const pending = new Map(); // auth code -> { email, challenge }
const lastCode = new Map(); // email -> code
const sessions = new Map(); // access token -> user id

function seed() {
  const now = Date.now();
  const t = (o) => ({
    id: randomUUID(),
    reference: 'HR-' + randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
    user_id: null,
    source: 'website',
    contact_name: null,
    contact_email: null,
    subject: null,
    locale: 'ar',
    status: 'open',
    response: null,
    responded_by: null,
    responded_at: null,
    first_responded_at: null,
    closed_at: null,
    status_changed_by: null,
    email_status: null,
    email_message_id: null,
    email_attempts: 0,
    email_last_error: null,
    email_last_attempt_at: null,
    email_sent_at: null,
    email_status_at: null,
    email_response_hash: null,
    ...o,
  });
  tickets = [
    t({
      reference: 'HR-WEB00001',
      contact_name: 'Sara',
      contact_email: 'sara@example.invalid',
      category: 'verification',
      subject: 'Cannot verify',
      message: 'The verify button says I am outside my neighborhood.',
      created_at: new Date(now - 3600e3).toISOString(),
    }),
    t({
      reference: 'HR-APP00002',
      source: 'app',
      user_id: users.resident.id,
      category: 'bug',
      message: 'The map does not load on my phone.',
      locale: null,
      created_at: new Date(now - 2 * 3600e3).toISOString(),
    }),
    t({
      reference: 'HR-WEB00003',
      contact_email: 'old@example.invalid',
      category: 'general',
      subject: 'Thanks',
      message: 'Just saying thanks for the app, it is great.',
      status: 'closed',
      response: 'Thank you!',
      responded_by: users.admin.id,
      responded_at: new Date(now - 20 * 3600e3).toISOString(),
      first_responded_at: new Date(now - 20 * 3600e3).toISOString(),
      closed_at: new Date(now - 20 * 3600e3).toISOString(),
      created_at: new Date(now - 30 * 3600e3).toISOString(),
    }),
  ];
  resendMode = 'ok';
  resendSent.clear();
  resendCalls.length = 0;
}
seed();

const md5 = (s) => createHash('md5').update(s).digest('hex');
const nameOf = (id) => {
  const u = byId(id);
  return u ? `${u.first_name} ${u.last_name}` : null;
};

function jwtFor(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    session_id: randomUUID(),
  };
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.${b64url('stub-signature')}`;
}
function session(user) {
  const access = jwtFor(user);
  sessions.set(access, user.id);
  return {
    access_token: access,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: randomUUID(),
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'apple' },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };
}
const caller = (req) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  return byId(sessions.get(token));
};
const isStaff = (u) => u && (u.app_role === 'admin' || u.app_role === 'moderator');

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const pgErr = (res, message, status = 400) => send(res, status, { code: 'P0001', message, details: null, hint: null });

function listRows(a) {
  const q = a.p_query ? String(a.p_query).toLowerCase() : null;
  let rows = tickets.filter(
    (t) =>
      (!a.p_status || t.status === a.p_status) &&
      (!a.p_source || t.source === a.p_source) &&
      (!a.p_category || t.category === a.p_category) &&
      (!a.p_from || t.created_at >= a.p_from) &&
      (!a.p_to || t.created_at < a.p_to) &&
      (!a.p_customer || (t.contact_email ?? '').toLowerCase() === String(a.p_customer).toLowerCase() || t.user_id === a.p_customer) &&
      (!q || [t.reference, t.contact_email, t.message, t.subject, t.contact_name].some((v) => (v ?? '').toLowerCase().includes(q))),
  );
  rows = rows.sort((x, y) => y.created_at.localeCompare(x.created_at));
  return {
    total: rows.length,
    rows: rows.slice(a.p_offset ?? 0, (a.p_offset ?? 0) + (a.p_limit ?? 25)).map((t) => ({
      id: t.id,
      reference: t.reference,
      source: t.source,
      category: t.category,
      status: t.status,
      subject: t.subject,
      message_preview: t.message.slice(0, 240),
      contact_name: t.contact_name,
      contact_email: t.contact_email,
      user_id: t.user_id,
      created_at: t.created_at,
      responded_at: t.responded_at,
      email_status: t.email_status,
      app_user_name: t.user_id ? nameOf(t.user_id) : null,
    })),
  };
}

const RPC = {
  admin_list_support_requests: (a) => listRows(a),
  admin_get_support_request: (a) => {
    const t = tickets.find((x) => x.id === a.request);
    return t
      ? {
          ...t,
          app_user_name: t.user_id ? nameOf(t.user_id) : null,
          responder_name: nameOf(t.responded_by),
          status_changed_by_name: nameOf(t.status_changed_by),
        }
      : null;
  },
  admin_support_overview: (a) => {
    const days = a.p_days ?? 30;
    const today = new Date();
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(today.getTime() - (days - 1 - i) * 86400e3).toISOString().slice(0, 10);
      return { day: d, count: tickets.filter((t) => t.created_at.slice(0, 10) === d).length };
    });
    const responded = tickets.filter((t) => t.first_responded_at);
    const avg = responded.length
      ? responded.reduce((s, t) => s + (Date.parse(t.first_responded_at) - Date.parse(t.created_at)) / 1000, 0) / responded.length
      : null;
    const by = {};
    for (const t of tickets) by[t.category] = (by[t.category] ?? 0) + 1;
    const c = (f) => tickets.filter(f).length;
    return {
      total: tickets.length,
      open: c((t) => t.status === 'open'),
      answered: c((t) => t.status === 'answered'),
      closed: c((t) => t.status === 'closed'),
      today: c((t) => Date.now() - Date.parse(t.created_at) < 86400e3),
      week: tickets.length,
      month: tickets.length,
      website: c((t) => t.source === 'website'),
      app: c((t) => t.source === 'app'),
      responded: responded.length,
      avg_first_response_seconds: avg && Math.round(avg),
      median_first_response_seconds: avg && Math.round(avg),
      by_category: by,
      emails_failed: c((t) => t.email_status === 'failed'),
      series,
      time_zone: 'Asia/Riyadh',
      days,
    };
  },
  admin_support_customers: () => {
    const groups = new Map();
    for (const t of tickets) {
      const key = (t.contact_email ?? t.user_id).toLowerCase();
      const g = groups.get(key) ?? {
        customer_key: key,
        source: t.source,
        email: t.contact_email,
        name: t.contact_name ?? (t.user_id ? nameOf(t.user_id) : null),
        tickets: 0,
        open_tickets: 0,
        first_at: t.created_at,
        last_at: t.created_at,
      };
      g.tickets++;
      if (t.status === 'open') g.open_tickets++;
      groups.set(key, g);
    }
    const rows = [...groups.values()];
    return { total: rows.length, rows };
  },
  respond_support_request: (a, u) => {
    const t = tickets.find((x) => x.id === a.request);
    if (!t) throw new Error('not found');
    const body = String(a.response ?? '').trim();
    if (!body) throw new Error('invalid:response');
    Object.assign(t, {
      response: body,
      responded_by: u.id,
      responded_at: new Date().toISOString(),
      first_responded_at: t.first_responded_at ?? new Date().toISOString(),
      status: a.close ? 'closed' : 'answered',
      closed_at: a.close ? new Date().toISOString() : null,
      status_changed_by: u.id,
      email_status:
        t.source !== 'website'
          ? null
          : t.email_response_hash === md5(body) && ['sent', 'delivered'].includes(t.email_status)
            ? t.email_status
            : 'pending',
    });
    return null;
  },
  set_support_request_status: (a, u) => {
    const t = tickets.find((x) => x.id === a.request);
    if (!t) throw new Error('not found');
    if (a.new_status === 'answered' && !t.response) throw new Error('invalid:no_response');
    Object.assign(t, {
      status: a.new_status,
      closed_at: a.new_status === 'closed' ? (t.closed_at ?? new Date().toISOString()) : null,
      status_changed_by: u.id,
    });
    return null;
  },
  claim_support_reply_email: (a) => {
    const t = tickets.find((x) => x.id === a.request);
    if (!t) throw new Error('not found');
    if (t.source !== 'website' || !t.contact_email) throw new Error('email:not_applicable');
    if (!t.response) throw new Error('email:no_response');
    const h = md5(t.response);
    if (t.email_response_hash === h && ['sent', 'delivered', 'delivery_delayed'].includes(t.email_status))
      throw new Error('email:already_sent');
    if (t.email_status === 'sending') throw new Error('email:in_progress');
    Object.assign(t, {
      email_status: 'sending',
      email_attempts: t.email_attempts + 1,
      email_last_attempt_at: new Date().toISOString(),
      email_response_hash: h,
    });
    return [
      {
        contact_email: t.contact_email,
        contact_name: t.contact_name,
        reference: t.reference,
        subject: t.subject,
        locale: t.locale,
        response: t.response,
        response_hash: h,
        attempt: t.email_attempts,
      },
    ];
  },
  record_support_reply_email: (a) => {
    const t = tickets.find((x) => x.id === a.request);
    if (!t || t.email_status !== 'sending' || t.email_response_hash !== a.response_hash) throw new Error('email:not_claimed');
    Object.assign(t, {
      email_status: a.accepted ? 'sent' : 'failed',
      email_message_id: a.accepted ? a.message_id : t.email_message_id,
      email_sent_at: a.accepted ? new Date().toISOString() : t.email_sent_at,
      email_status_at: new Date().toISOString(),
      email_last_error: a.accepted ? null : a.error,
    });
    return null;
  },
  update_support_reply_email_status: (a) => {
    const t = tickets.find((x) => x.id === a.request);
    if (t && t.email_message_id === a.message_id)
      Object.assign(t, {
        email_status: a.provider_status === 'delivered' ? 'delivered' : t.email_status,
        email_status_at: new Date().toISOString(),
      });
    return null;
  },
};

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  try {
    // ---- test control
    if (p === '/__reset') return (seed(), send(res, 200, { ok: true }));
    if (p === '/__control') return ((resendMode = (await body(req)).resendMode ?? 'ok'), send(res, 200, { resendMode }));
    if (p === '/__state') return send(res, 200, { resendCalls: resendCalls.length, uniqueSends: resendSent.size, tickets });
    if (p === '/__code') return send(res, 200, { code: lastCode.get(url.searchParams.get('email')) ?? null });
    if (p === '/__add-ticket') {
      tickets.push({
        ...tickets[0],
        id: randomUUID(),
        reference: 'HR-NEW' + Math.floor(Math.random() * 1e4),
        status: 'open',
        created_at: new Date().toISOString(),
      });
      return send(res, 200, { ok: true });
    }

    // ---- Supabase Auth
    if (p === '/auth/v1/otp' && req.method === 'POST') {
      const b = await body(req);
      if (!byEmail(b.email))
        return send(res, 422, { code: 'otp_disabled', error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
      const code = randomUUID();
      pending.set(code, { email: b.email, challenge: b.code_challenge });
      lastCode.set(b.email, code);
      return send(res, 200, {});
    }
    if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const b = await body(req);
      const entry = pending.get(b.auth_code);
      if (!entry) return send(res, 400, { code: 'flow_state_not_found', msg: 'invalid flow state' });
      const challenge = createHash('sha256')
        .update(b.code_verifier ?? '')
        .digest('base64url');
      if (challenge !== entry.challenge) return send(res, 400, { code: 'bad_code_verifier', msg: 'code challenge does not match' });
      pending.delete(b.auth_code);
      return send(res, 200, session(byEmail(entry.email)));
    }
    if (p === '/auth/v1/verify' && req.method === 'POST') {
      const b = await body(req);
      const u = byEmail(b.email);
      if (!u || b.token !== '424242') return send(res, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
      return send(res, 200, session(u));
    }
    if (p === '/auth/v1/user') {
      const u = caller(req);
      return u ? send(res, 200, session(u).user) : send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' });
    }
    if (p === '/auth/v1/logout') {
      sessions.delete((req.headers.authorization ?? '').replace(/^Bearer /, ''));
      return send(res, 204);
    }

    // ---- PostgREST
    if (p === '/rest/v1/profiles') {
      const u = caller(req);
      const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
      const row =
        u && id === u.id ? [{ id: u.id, first_name: u.first_name, last_name: u.last_name, app_role: u.app_role, deleted_at: null }] : [];
      if ((req.headers.accept ?? '').includes('vnd.pgrst.object'))
        return row.length ? send(res, 200, row[0]) : send(res, 406, { code: 'PGRST116', message: 'no rows' });
      return send(res, 200, row);
    }
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      const u = caller(req);
      if (!RPC[fn]) return send(res, 404, { code: 'PGRST202', message: 'not found' });
      if (!isStaff(u)) return pgErr(res, 'not_authorized');
      try {
        return send(res, 200, RPC[fn](await body(req), u));
      } catch (e) {
        return pgErr(res, e.message);
      }
    }

    // ---- Resend
    if (p === '/emails' && req.method === 'POST') {
      resendCalls.push(Date.now());
      if (resendMode === 'fail') return send(res, 500, { name: 'internal_server_error', message: 'Stub failure' });
      if (resendMode === 'reject') return send(res, 422, { name: 'validation_error', message: 'Invalid from address' });
      const key = req.headers['idempotency-key'];
      if (!resendSent.has(key)) resendSent.set(key, 're_' + randomUUID().slice(0, 8));
      return send(res, 200, { id: resendSent.get(key) });
    }
    if (p.startsWith('/emails/')) return send(res, 200, { id: p.slice(8), last_event: 'delivered' });

    send(res, 404, { message: 'stub: unknown route ' + p });
  } catch (e) {
    send(res, 500, { message: String(e) });
  }
}).listen(PORT, () => console.log(`stub listening on ${PORT}`));
