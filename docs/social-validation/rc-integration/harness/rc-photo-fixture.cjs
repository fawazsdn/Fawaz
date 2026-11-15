/* global __dirname */
// B: private account with a profile photo; A: accepted follower. Loopback stack only.
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs'); const path = require('node:path');
const admin = createClient('http://127.0.0.1:55421', process.env.LOCAL_SERVICE_KEY, { auth: { persistSession: false } });
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'rc-fixture.json')));
const get = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
(async () => {
  const A = fx.accounts.a.id, B = fx.accounts.b.id, obj = `${B}/rc-avatar.jpg`;
  const bytes = fs.readFileSync(path.join(__dirname, 'media/ten/rc-photo-07.jpg'));
  await admin.storage.from('profile-photos').remove([obj]);
  get(await admin.storage.from('profile-photos').upload(obj, bytes, { contentType: 'image/jpeg' }));
  get(await admin.from('profiles').update({ avatar_path: obj, is_private: true }).eq('id', B));
  get(await admin.from('user_blocks').delete().or(`and(blocker_id.eq.${B},blocked_id.eq.${A}),and(blocker_id.eq.${A},blocked_id.eq.${B})`));
  get(await admin.from('follows').upsert({ follower_id: A, followee_id: B, status: 'accepted', accepted_at: new Date().toISOString() }));
  fs.writeFileSync(path.join(__dirname, 'rc-photo-fixture.json'), JSON.stringify({ obj }), { mode: 0o600 });
  console.log('photo fixture ready: B private with photo, A accepted follower, no blocks');
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
