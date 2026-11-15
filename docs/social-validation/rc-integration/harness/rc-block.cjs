/* global __dirname */
// usage: node rc-block.cjs block|unblock  -- B blocks/unblocks A through the API, as B.
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs'); const path = require('node:path');
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'rc-fixture.json')));
(async () => {
  const b = createClient('http://127.0.0.1:55421', process.env.LOCAL_ANON_KEY, { auth: { persistSession: false } });
  const s = await b.auth.signInWithPassword({ email: fx.accounts.b.email, password: fx.password });
  if (s.error) throw new Error('B sign-in failed');
  const r = process.argv[2] === 'unblock'
    ? await b.from('user_blocks').delete().eq('blocker_id', fx.accounts.b.id).eq('blocked_id', fx.accounts.a.id)
    : await b.from('user_blocks').insert({ blocker_id: fx.accounts.b.id, blocked_id: fx.accounts.a.id });
  if (r.error) throw new Error(r.error.message);
  console.log(`B ${process.argv[2] || 'block'}ed A at ${new Date().toISOString()}`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
