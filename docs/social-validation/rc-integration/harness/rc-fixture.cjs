/* global __dirname */
// Synthetic fixture for the RC Simulator run (loopback stack only; refuses any other URL).
// Creates two verified, onboarded accounts in one neighborhood and a post by B.
// Writes credentials to rc-fixture.json (mode 600) and RcFixture.swift; prints no secrets.
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

const URL = 'http://127.0.0.1:55421';
const admin = createClient(URL, process.env.LOCAL_SERVICE_KEY, { auth: { persistSession: false } });
const NB = 'sa-district-10500227013';
const out = (f) => path.join(__dirname, f);
const get = (r) => { if (r.error) throw new Error(r.error.message || r.error.code || 'fixture failed'); return r.data; };

(async () => {
  const tag = 'rc' + crypto.randomUUID().slice(0, 6);
  const password = 'Rc-' + crypto.randomUUID();
  const accounts = {};
  for (const [key, first] of [['a', 'RcAlpha'], ['b', 'RcBravo']]) {
    const email = `${tag}-${key}@example.invalid`;
    const id = get(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
    get(await admin.from('neighborhood_memberships').insert({
      user_id: id, neighborhood_id: NB, active: true, verified_at: new Date().toISOString(), verification_status: 'verified',
    }));
    get(await admin.from('profiles').update({ profile_completed: true, first_name: first, last_name: 'Synthetic' }).eq('id', id));
    accounts[key] = { id, email };
  }
  const post = get(await admin.from('posts').insert({
    type: 'general', author_id: accounts.b.id, neighborhood_id: NB, text_ar: `RC target post ${tag}`, audience: 'neighborhood',
  }).select('id').single()).id;
  fs.writeFileSync(out('rc-fixture.json'), JSON.stringify({ tag, password, accounts, post }, null, 1), { mode: 0o600 });
  fs.writeFileSync(out('RcFixture.swift'), [
    `let rcTag = ${JSON.stringify(tag)}`,
    `let rcPassword = ${JSON.stringify(password)}`,
    `let rcEmailA = ${JSON.stringify(accounts.a.email)}`,
    `let rcEmailB = ${JSON.stringify(accounts.b.email)}`,
    `let rcPost = ${JSON.stringify(post)}`,
    '',
  ].join('\n'), { mode: 0o600 });
  console.log(`fixture ${tag}: accounts a,b created and verified; target post created`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
