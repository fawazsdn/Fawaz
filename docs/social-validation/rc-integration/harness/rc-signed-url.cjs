/* global __dirname */
// A's access to B's private profile photo before/after B blocks A, through link expiry.
const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'rc-fixture.json')));
const { obj } = JSON.parse(fs.readFileSync(path.join(__dirname, 'rc-photo-fixture.json')));
const TTL = 300; // PROFILE_PHOTO_LINK_SECONDS in src/backend/mediaPrivacy.ts
const t0 = Date.now(); const ts = () => `t+${Math.round((Date.now() - t0) / 1000)}s`;
const status = async (url) => (await fetch(url)).status;
(async () => {
  const a = createClient('http://127.0.0.1:55421', process.env.LOCAL_ANON_KEY, { auth: { persistSession: false } });
  if ((await a.auth.signInWithPassword({ email: fx.accounts.a.email, password: fx.password })).error) throw new Error('A sign-in failed');
  const before = await a.storage.from('profile-photos').createSignedUrl(obj, TTL);
  console.log(`${ts()} A signs B's photo while following: ${before.error ? 'DENIED ' + before.error.message : 'OK'}`);
  console.log(`${ts()} A fetches that link: HTTP ${await status(before.data.signedUrl)}`);
  console.log(`${ts()} ${execFileSync('node', [path.join(__dirname, 'rc-block.cjs'), 'block'], { env: process.env }).toString().trim()}`);
  const after = await a.storage.from('profile-photos').createSignedUrl(obj, TTL);
  console.log(`${ts()} A signs again after the block: ${after.error ? 'DENIED (' + after.error.message + ')' : 'ISSUED (unexpected)'}`);
  const dl = await a.storage.from('profile-photos').download(obj);
  console.log(`${ts()} A downloads directly after the block: ${dl.error ? 'DENIED' : 'ALLOWED (unexpected)'}`);
  const prof = await a.rpc('social_profile', { target: fx.accounts.b.id });
  console.log(`${ts()} A's social_profile of B after the block: ${prof.error ? 'error ' + prof.error.message : JSON.stringify(prof.data && { avatar_path: prof.data.avatar_path ?? null, visible: !!prof.data })}`);
  console.log(`${ts()} previously issued link right after the block: HTTP ${await status(before.data.signedUrl)} (residual until expiry)`);
  for (const at of [120, TTL - 10, TTL + 15]) {
    await new Promise((r) => setTimeout(r, Math.max(0, at * 1000 - (Date.now() - t0))));
    console.log(`${ts()} previously issued link: HTTP ${await status(before.data.signedUrl)}`);
  }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
