#!/usr/bin/env node
// Builds the static Haratna website (Arabic first, English under /en/) from
// the same legal content the app shows (src/content/legal.json), so the
// website and the app never disagree. Output: website/ (plain HTML + CSS, no
// build step, deployable to any static host).
//
//   node scripts/build-website.mjs
//
// Owner details come from src/content/legal-config.json. While they are
// empty, every page shows a visible "not ready for launch" banner.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legal = JSON.parse(readFileSync(join(root, 'src/content/legal.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'src/content/legal-config.json'), 'utf8'));
const out = join(root, 'website');

const missing = ['operatorEn', 'operatorAr', 'supportEmail', 'dataRegion', 'emailProvider', 'backupRetention', 'websiteBaseUrl'].filter(
  (k) => !config[k],
);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fill(text, ar) {
  const fallback = {
    OPERATOR: ar ? 'فريق حارتنا' : 'the Haratna team',
    SUPPORT_EMAIL: ar ? 'نموذج «تواصل مع الدعم» داخل التطبيق' : 'the in-app Contact support form',
    DATA_REGION: ar ? 'متاح عند الطلب عبر الدعم' : 'available on request through support',
    EMAIL_PROVIDER: ar ? 'متاح عند الطلب عبر الدعم' : 'available on request through support',
    BACKUP_RETENTION: ar ? 'متاح عند الطلب عبر الدعم' : 'available on request through support',
  };
  const values = {
    OPERATOR: (ar ? config.operatorAr : config.operatorEn) || fallback.OPERATOR,
    SUPPORT_EMAIL: config.supportEmail || fallback.SUPPORT_EMAIL,
    DATA_REGION: config.dataRegion || fallback.DATA_REGION,
    EMAIL_PROVIDER: config.emailProvider || fallback.EMAIL_PROVIDER,
    BACKUP_RETENTION: config.backupRetention || fallback.BACKUP_RETENTION,
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => values[k] ?? '');
}

const T = {
  ar: {
    dir: 'rtl',
    other: 'English',
    tagline: 'حيك، مجتمعك، جيرانك',
    nav: { index: 'الرئيسية', about: 'عن حارتنا', help: 'مركز المساعدة', support: 'الدعم' },
    footer: {
      privacy: 'سياسة الخصوصية',
      terms: 'شروط الاستخدام',
      guidelines: 'إرشادات المجتمع',
      deletion: 'حذف الحساب',
      support: 'تواصل مع الدعم',
    },
    updated: 'آخر تحديث',
    banner: 'مسودة: بيانات الجهة المشغّلة وبريد الدعم لم تُعتمد بعد. هذه الصفحات غير جاهزة للنشر العام.',
    heroTitle: 'حيك كله في مكان واحد',
    heroBody: 'حارتنا تربطك بسكان حيّك الموثّقين فقط: أخبار الحي، الأنشطة، الأندية، الجيران، وسوق الحي، بخصوصية تامة.',
    soon: 'قريباً على App Store',
    features: [
      ['أخبار الحي', 'انشر واسأل جيرانك وصوّت في استطلاعات الحي.'],
      ['الأنشطة والفعاليات', 'اكتشف أنشطة حيّك وانضم أو نظّم نشاطك.'],
      ['الأندية', 'أندية الحي بمراجعة فريق حارتنا ودردشة خاصة للأعضاء.'],
      ['الجيران', 'طلبات متبادلة يقبلها الطرف الآخر، والظهور في الاكتشاف اختياري.'],
      ['سوق الحي والاستعارة', 'بع أو أعطِ أو استعر من جيرانك.'],
      ['الفزعة والبلاغات', 'اطلب المساعدة وأبلغ عن المفقودات ومشاكل الحي.'],
    ],
    privacyTitle: 'خصوصيتك أولاً',
    privacyPoints: [
      'محتوى كل حي يظهر لسكانه الموثّقين فقط.',
      'لا نعرض عنوانك أو موقعك الدقيق أو رقم جوالك أو بريدك لأحد.',
      'نتحقق من حيّك عبر موقعك مرة واحدة دون حفظ الإحداثيات.',
      'يمكنك حذف حسابك من داخل التطبيق في أي وقت.',
    ],
    supportTitle: 'تواصل مع الدعم',
    supportInApp: 'أسرع طريقة: من داخل التطبيق افتح الإعدادات ← «تواصل مع الدعم». يصل طلبك لفريق حارتنا وتصلك الإجابة داخل التطبيق.',
    supportEmail: 'أو راسلنا على البريد:',
    supportNoEmail: 'بريد الدعم سيُعلن قبل الإطلاق.',
    safety:
      'للإبلاغ عن محتوى أو مستخدم: اضغط «إبلاغ» على المنشور أو الرسالة أو الملف الشخصي، أو استخدم «حظر» لإيقاف التواصل فوراً. في حالات الطوارئ اتصل بـ 911 أو 999 أو 997 أو 998.',
  },
  en: {
    dir: 'ltr',
    other: 'العربية',
    tagline: 'Your Neighborhood, Connected',
    nav: { index: 'Home', about: 'About', help: 'Help Center', support: 'Support' },
    footer: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Use',
      guidelines: 'Community Guidelines',
      deletion: 'Delete your account',
      support: 'Contact support',
    },
    updated: 'Last updated',
    banner: 'Draft: the operator details and support email have not been confirmed yet. These pages are not ready for public launch.',
    heroTitle: 'Your Neighborhood in One Place',
    heroBody:
      'Haratna connects you only with the verified residents of your neighborhood: local news, activities, clubs, neighbors and a neighborhood marketplace, privately.',
    soon: 'Coming soon to the App Store',
    features: [
      ['Neighborhood news', 'Post, ask your neighbors and vote in neighborhood polls.'],
      ['Activities and events', 'Find local activities, join one or organize your own.'],
      ['Clubs', 'Neighborhood clubs reviewed by the Haratna team, with a members-only chat.'],
      ['Neighbors', 'Mutual requests the other person accepts; discovery is opt-in.'],
      ['Marketplace and borrowing', 'Sell, give away or borrow from neighbors.'],
      ['Help and reports', 'Ask for a hand, post lost & found, report neighborhood issues.'],
    ],
    privacyTitle: 'Privacy first',
    privacyPoints: [
      "Each neighborhood's content is visible only to its verified residents.",
      'Your address, exact location, phone number and email are never shown to anyone.',
      'Your neighborhood is verified once with your location; coordinates are not stored.',
      'Delete your account inside the app at any time.',
    ],
    supportTitle: 'Contact support',
    supportInApp:
      'Fastest: in the app, open Settings → "Contact support". Your request reaches the Haratna team and the reply arrives in the app.',
    supportEmail: 'Or email us:',
    supportNoEmail: 'A support email will be announced before launch.',
    safety:
      'To report content or a person, tap Report on the post, message or profile, or use Block to stop contact immediately. In an emergency call 911, 999, 997 or 998.',
  },
};

const PAGES = ['index', 'about', 'help', 'support', 'privacy', 'terms', 'guidelines', 'delete-account'];
const DOC_FOR = {
  about: 'about',
  help: 'help',
  privacy: 'privacy',
  terms: 'terms',
  guidelines: 'guidelines',
  'delete-account': 'deletion',
};

const href = (lang, page) => {
  const base = lang === 'ar' ? '/' : '/en/';
  return page === 'index' ? base : `${base}${page}/`;
};

function sections(doc, lang) {
  const ar = lang === 'ar';
  return legal[lang][doc].sections
    .map((s) => {
      let h = '<section>';
      if (s.h) h += `<h2>${esc(fill(s.h, ar))}</h2>`;
      for (const p of s.p ?? []) h += `<p>${esc(fill(p, ar))}</p>`;
      if (s.li) h += `<ul>${s.li.map((x) => `<li>${esc(fill(x, ar))}</li>`).join('')}</ul>`;
      return h + '</section>';
    })
    .join('\n');
}

function body(page, lang) {
  const t = T[lang];
  if (page === 'index') {
    return `<section class="hero"><img src="/assets/icon.png" alt="" width="96" height="96"><h1>${esc(t.heroTitle)}</h1><p class="lead">${esc(t.heroBody)}</p><p class="pill">${esc(t.soon)}</p></section>
<section class="grid">${t.features.map(([h, p]) => `<article class="card"><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join('')}</section>
<section class="card"><h2>${esc(t.privacyTitle)}</h2><ul>${t.privacyPoints.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  }
  if (page === 'support') {
    const email = config.supportEmail
      ? `<p>${esc(t.supportEmail)} <a href="mailto:${esc(config.supportEmail)}">${esc(config.supportEmail)}</a></p>`
      : `<p class="muted">${esc(t.supportNoEmail)}</p>`;
    return `<h1>${esc(t.supportTitle)}</h1><section class="card"><p>${esc(t.supportInApp)}</p>${email}</section><section class="card"><p>${esc(t.safety)}</p></section>
<p><a href="${href(lang, 'help')}">${esc(t.nav.help)}</a> · <a href="${href(lang, 'delete-account')}">${esc(t.footer.deletion)}</a></p>`;
  }
  const doc = DOC_FOR[page];
  const showDate = ['privacy', 'terms', 'guidelines', 'deletion'].includes(doc);
  return `<h1>${esc(legal[lang][doc].title)}</h1>${showDate ? `<p class="muted">${esc(t.updated)}: ${esc(legal.updated)}</p>` : ''}\n<div class="doc">${sections(doc, lang)}</div>`;
}

function title(page, lang) {
  const t = T[lang];
  if (page === 'index') return `${lang === 'ar' ? 'حارتنا' : 'Haratna'} | ${t.tagline}`;
  if (page === 'support') return `${t.supportTitle} | ${lang === 'ar' ? 'حارتنا' : 'Haratna'}`;
  return `${legal[lang][DOC_FOR[page]].title} | ${lang === 'ar' ? 'حارتنا' : 'Haratna'}`;
}

function render(page, lang) {
  const t = T[lang];
  const other = lang === 'ar' ? 'en' : 'ar';
  const base = config.websiteBaseUrl ? config.websiteBaseUrl.replace(/\/$/, '') : '';
  const alt = base
    ? `<link rel="alternate" hreflang="ar" href="${esc(base + href('ar', page))}"><link rel="alternate" hreflang="en" href="${esc(base + href('en', page))}">`
    : '';
  const nav = Object.entries(t.nav)
    .map(([k, v]) => `<a href="${href(lang, k)}"${k === page ? ' aria-current="page"' : ''}>${esc(v)}</a>`)
    .join('');
  const foot = [
    ['privacy', t.footer.privacy],
    ['terms', t.footer.terms],
    ['guidelines', t.footer.guidelines],
    ['delete-account', t.footer.deletion],
    ['support', t.footer.support],
  ]
    .map(([k, v]) => `<a href="${href(lang, k)}">${esc(v)}</a>`)
    .join('');
  const banner = missing.length ? `<div class="banner" role="status">${esc(t.banner)}</div>` : '';
  const operator = (lang === 'ar' ? config.operatorAr : config.operatorEn) || (lang === 'ar' ? 'حارتنا' : 'Haratna');
  return `<!doctype html>
<html lang="${lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title(page, lang))}</title>
<meta name="description" content="${esc(t.heroBody)}">
<meta name="theme-color" content="#0D4939">
${missing.length ? '<meta name="robots" content="noindex">' : ''}${alt}
<link rel="icon" href="/assets/favicon.png">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">${lang === 'ar' ? 'تخطّ إلى المحتوى' : 'Skip to content'}</a>
${banner}
<header><div class="wrap bar"><a class="brand" href="${href(lang, 'index')}"><img src="/assets/icon.png" alt="" width="32" height="32"><span>${lang === 'ar' ? 'حارتنا' : 'Haratna'}</span></a>
<nav aria-label="${lang === 'ar' ? 'القائمة' : 'Main'}">${nav}<a class="lang" href="${href(other, page)}" hreflang="${other}" lang="${other}">${esc(t.other)}</a></nav></div></header>
<main id="main" class="wrap">
${body(page, lang)}
</main>
<footer><div class="wrap"><nav aria-label="${lang === 'ar' ? 'روابط' : 'Links'}">${foot}</nav><p class="muted">© ${new Date(legal.updated).getUTCFullYear()} ${esc(operator)}</p></div></footer>
</body>
</html>
`;
}

const CSS = `:root{--green:#0D4939;--deep:#07352A;--sand:#F4EFE3;--gold:#D2B078;--sage:#83977A;--bg:var(--sand);--fg:#13221d;--card:#fffdf8;--muted:#5b6b62;--line:#e4dccb}
@media (prefers-color-scheme:dark){:root{--bg:#07352A;--fg:#F4EFE3;--card:#0D4939;--muted:#c9d2c4;--line:#1f5a49}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.7 "Tajawal","Segoe UI",system-ui,-apple-system,sans-serif}
html[lang=en] body{font-family:"Plus Jakarta Sans","Segoe UI",system-ui,-apple-system,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:0 16px}
a{color:inherit}main a{color:var(--green);font-weight:600}@media (prefers-color-scheme:dark){main a{color:var(--gold)}}
.skip{position:absolute;inset-inline-start:-999px}.skip:focus{inset-inline-start:16px;top:8px;background:var(--gold);color:#07352A;padding:8px 12px;z-index:9}
.banner{background:#7a2e1d;color:#fff;padding:10px 16px;text-align:center;font-weight:600}
header{background:var(--green);color:var(--sand)}
.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding-top:12px;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;font-size:20px}.brand img{border-radius:8px}
header nav{display:flex;flex-wrap:wrap;gap:4px 14px}header nav a{text-decoration:none;opacity:.9;padding:4px 0}header nav a[aria-current]{border-bottom:2px solid var(--gold)}
.lang{background:var(--gold);color:#07352A;border-radius:999px;padding:4px 12px!important;font-weight:700}
main{padding-top:28px;padding-bottom:48px}
h1{font-size:clamp(26px,5vw,38px);line-height:1.3;margin:0 0 12px;color:var(--green)}@media (prefers-color-scheme:dark){h1{color:var(--gold)}}
h2{font-size:20px;margin:24px 0 8px}
.hero{text-align:center;padding:16px 0 8px}.hero img{border-radius:22px}.lead{font-size:19px;max-width:640px;margin:0 auto}
.pill{display:inline-block;margin-top:16px;background:var(--green);color:var(--sand);border-radius:999px;padding:8px 18px;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:24px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:12px 0}.card h2{margin-top:0}
.grid .card{margin:0}
.muted{color:var(--muted)}ul{padding-inline-start:22px}li{margin:6px 0}
.doc section{border-bottom:1px solid var(--line);padding-bottom:8px}
footer{border-top:1px solid var(--line);padding:20px 0 32px;font-size:15px}footer nav{display:flex;flex-wrap:wrap;gap:6px 16px}
`;

mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'assets/site.css'), CSS);
copyFileSync(join(root, 'assets/icon.png'), join(out, 'assets/icon.png'));
copyFileSync(join(root, 'assets/favicon.png'), join(out, 'assets/favicon.png'));
for (const lang of ['ar', 'en']) {
  for (const page of PAGES) {
    const dir = join(out, lang === 'en' ? 'en' : '', page === 'index' ? '' : page);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), render(page, lang));
  }
}
writeFileSync(
  join(out, '404.html'),
  render('index', 'ar').replace(
    /<main id="main" class="wrap">[\s\S]*<\/main>/,
    '<main id="main" class="wrap"><h1>الصفحة غير موجودة · Page not found</h1><p><a href="/">حارتنا</a> · <a href="/en/">Haratna</a></p></main>',
  ),
);
console.log(`website/ built: ${PAGES.length * 2} pages${missing.length ? `; DRAFT banner on (missing: ${missing.join(', ')})` : ''}`);
