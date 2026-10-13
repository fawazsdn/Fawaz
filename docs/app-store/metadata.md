# App Store metadata — Haratna (حارتنا)

Prepared 2026-10-14 for App Store Connect. Every feature described here is
implemented in the current branch (`claude/haratna-frontend-build-bdy51c`).
Nothing describes push notifications, payments or features that are not built.

Character counts were measured by script. App Store Connect limits used:
name 30, subtitle 30, promotional text 170, keywords 100, description 4,000.

> **Owner check:** keyword limits are enforced by App Store Connect itself.
> If the Arabic keyword field rejects the primary list, use the "short"
> list (it is under 100 bytes as well as 100 characters).

---

## App name

| Locale           | Value               | Length |
| ---------------- | ------------------- | ------ |
| Arabic (primary) | `حارتنا \| Haratna` | 16     |
| English (U.S.)   | `حارتنا \| Haratna` | 16     |

Name availability can only be confirmed inside App Store Connect. The
existing app record for `sa.haratna.app` should already reserve its name.
Do **not** create a new app record.

## Subtitle

| Locale  | Value                          | Length |
| ------- | ------------------------------ | ------ |
| Arabic  | `حيك، مجتمعك، جيرانك`          | 19     |
| English | `Your Neighborhood, Connected` | 28     |

## Category

- **Primary:** Social Networking
- **Secondary:** Lifestyle

Rationale: the core is verified residents connecting, posting and
messaging (Social Networking). Activities, clubs and the neighborhood
marketplace fit Lifestyle.

## Keywords

**Arabic (primary, 94 characters):**

```
حارتنا,الحي,جيران,حي,مجتمع,فعاليات,أندية,أنشطة,سوق,الرياض,جدة,الدمام,الخبر,مساعدة,بلاغات,خريطة
```

**Arabic (short, 40 characters, 74 bytes):**

```
الحي,جيران,مجتمع,فعاليات,أندية,أنشطة,سوق
```

**English (95 characters):**

```
neighborhood,neighbors,community,local,events,clubs,activities,marketplace,saudi,riyadh,dhahran
```

The app name is indexed separately, so "Haratna" is not repeated in keywords.
No competitor names are used.

## Promotional text (can be changed without a new build)

**Arabic (≤170):**

> حارتنا تجمع سكان حيّك الموثّقين في مكان واحد: أخبار الحي، الأنشطة، الأندية، وسوق الحي. تعرّف على جيرانك بخصوصية تامة.

**English (≤170):**

> Haratna brings the verified residents of your neighborhood together: local news, activities, clubs and a neighborhood marketplace. Meet your neighbors, privately.

## Description

### Arabic

```
حارتنا تطبيق حيّك. يربطك بسكان حيّك الموثّقين فقط، لتعرف ما يحدث حولك وتشارك فيه.

ما يمكنك فعله في حارتنا:

• أخبار الحي وأسئلته: انشر، اسأل جيرانك، علّق، وصوّت في استطلاعات الحي.
• الأنشطة والفعاليات: اكتشف مباريات كرة القدم والبادل والمشي والقهوة وغيرها، وانضم أو نظّم نشاطك الخاص مع موقع تقريبي على الخريطة.
• الأندية: انضم لأندية حيّك أو قدّم طلب إنشاء نادٍ. يراجع فريق حارتنا كل نادٍ قبل ظهوره، ولكل نادٍ دردشة خاصة بأعضائه وأنشطة متكررة.
• الجيران: أضف جيرانك بطلب يقبله الطرف الآخر، وادعهم لأنشطتك وأنديتك. الظهور في «اكتشف الجيران» اختياري ومغلق افتراضياً.
• الرسائل: تواصل مع جيرانك المتصلين أو بخصوص نشاط أو إعلان.
• سوق الحي والاستعارة: بع أو أعطِ أو استعر أغراضاً من جيرانك.
• الفزعة والمفقودات والبلاغات: اطلب المساعدة، أبلغ عن مفقود، أو بلّغ عن مشكلة في الحي مثل الإنارة أو الطرق.
• الخريطة: شاهد أنشطة الحي وأماكنه على الخريطة.
• مساعد الحي: اسأل بالعربية أو الإنجليزية عمّا يحدث في حيّك.

خصوصيتك أولاً:
• محتوى كل حي يظهر لسكانه الموثّقين فقط.
• لا نعرض عنوانك أو موقعك الدقيق أو رقم جوالك أو بريدك لأي أحد.
• نتحقق من حيّك مرة واحدة عبر موقعك دون حفظ إحداثياتك.
• بلاغ وحظر ومراجعة للمحتوى، وتصفية للكلمات المسيئة.
• يمكنك حذف حسابك من داخل التطبيق في أي وقت.

يدعم التطبيق العربية والإنجليزية والوضع الليلي.
```

### English

```
Haratna is your neighborhood's app. It connects you only with the verified residents of your own neighborhood, so you can see what's happening nearby and take part.

What you can do on Haratna:

• Neighborhood news and questions: post, ask your neighbors, comment and vote in neighborhood polls.
• Activities and events: find football, padel, walking, coffee meetups and more. Join, or organize your own with an approximate map location.
• Clubs: join your neighborhood's clubs or apply to start one. The Haratna team reviews every club before it appears. Each club has a members-only chat and can run recurring activities.
• Neighbors: add neighbors with a request they accept, then invite them to your activities and clubs. Appearing in Discover Neighbors is opt-in and off by default.
• Messages: chat with connected neighbors, or about an activity or listing.
• Marketplace and borrowing: sell, give away or borrow things from neighbors.
• Help, lost & found and issue reports: ask for a hand, report something lost or found, or report a problem such as street lighting or roads.
• Map: see your neighborhood's activities and places on a map.
• Neighborhood assistant: ask in Arabic or English about what's going on in your neighborhood.

Privacy first:
• Each neighborhood's content is visible only to its verified residents.
• Your address, exact location, phone number and email are never shown to anyone.
• Your neighborhood is verified once with your location; your coordinates are not stored.
• Report, block, content review and filtering of abusive words.
• Delete your account inside the app at any time.

Available in Arabic and English, with dark mode.
```

## What's New (version 1.0.0)

**Arabic:**

> الإصدار الأول من حارتنا: أخبار الحي، الأنشطة والفعاليات، الأندية بمراجعة فريق حارتنا، الجيران بطلبات متبادلة وخصوصية اختيارية، الرسائل، سوق الحي، الفزعة، المفقودات، البلاغات، والخريطة.

**English:**

> The first release of Haratna: neighborhood news, activities and events, clubs reviewed by the Haratna team, mutual neighbor connections with opt-in discovery, messages, the neighborhood marketplace, help requests, lost & found, issue reports and the map.

## URLs (required before submission)

| Field                    | Value                                                     | Status                                                                              |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Privacy Policy URL       | `<WEBSITE_BASE_URL>/privacy/` (Arabic) and `/en/privacy/` | **Needs owner:** deploy `website/` and confirm the domain                           |
| Support URL              | `<WEBSITE_BASE_URL>/support/`                             | **Needs owner:** same, plus a real support email in `src/content/legal-config.json` |
| Marketing URL (optional) | `<WEBSITE_BASE_URL>/`                                     | Optional                                                                            |

## Copyright

`© 2026 <legal entity name>`. **Needs owner:** the exact legal entity.

## Export compliance

`ITSAppUsesNonExemptEncryption = false` is already set in `app.json`. The app
uses only standard HTTPS/TLS provided by iOS, which is exempt.

## Content rights

The app shows user-generated content only. No third-party copyrighted content
is bundled. The neighborhood geography comes from the Saudi National Address
dataset. **Owner:** confirm the dataset's licence terms permit this use.
