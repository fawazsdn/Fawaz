import type { Locale } from '@/lib/i18n';

/**
 * FAQ grounded in the current app build (auth, neighborhood verification,
 * neighbors, messaging, moderation and deletion flows). Update it whenever
 * those flows change.
 */
export type FaqCategory =
  'about' | 'account' | 'verification' | 'privacy' | 'messaging' | 'safety' | 'blocking' | 'deletion' | 'troubleshooting' | 'feedback';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  q: string;
  a: string[];
}

export const FAQ_CATEGORY_LABELS: Record<Locale, Record<FaqCategory, string>> = {
  ar: {
    about: 'عن حارتنا',
    account: 'الحساب وتسجيل الدخول',
    verification: 'اختيار الحي وتوثيقه',
    privacy: 'الخصوصية',
    messaging: 'الجيران والرسائل',
    safety: 'البلاغات والسلامة',
    blocking: 'الحظر',
    deletion: 'حذف الحساب',
    troubleshooting: 'حل المشاكل',
    feedback: 'الاقتراحات',
  },
  en: {
    about: 'About Haratna',
    account: 'Account and sign-in',
    verification: 'Choosing and verifying your neighborhood',
    privacy: 'Privacy',
    messaging: 'Neighbors and messages',
    safety: 'Reporting and safety',
    blocking: 'Blocking',
    deletion: 'Deleting your account',
    troubleshooting: 'Troubleshooting',
    feedback: 'Feedback',
  },
};

const ar: FaqItem[] = [
  {
    id: 'what-is-haratna',
    category: 'about',
    q: 'ما هو حارتنا؟',
    a: [
      'حارتنا تطبيق للأحياء في المملكة العربية السعودية. يجمع سكان كل حي في مساحة خاصة بهم: أخبار الحي وإعلاناته، الأنشطة والأندية، الفزعة، المفقودات، سوق الحي، الاستطلاعات، والرسائل الخاصة بين الجيران.',
    ],
  },
  {
    id: 'who-can-join',
    category: 'about',
    q: 'من يستطيع الانضمام؟',
    a: [
      'أي شخص يسكن في حي داخل المملكة يستطيع إنشاء حساب. لرؤية محتوى الحي والمشاركة فيه يجب توثيق أنك تسكن في الحي. إنشاء الأندية وإدارتها متاح لمن عمرهم ١٨ سنة فأكثر فقط.',
    ],
  },
  {
    id: 'is-it-free',
    category: 'about',
    q: 'هل حارتنا مجاني؟',
    a: ['نعم. لا توجد مشتريات داخل التطبيق ولا اشتراكات ولا إعلانات. صفقات سوق الحي تتم بين السكان مباشرة، وحارتنا لا يتعامل بالمدفوعات.'],
  },
  {
    id: 'availability',
    category: 'about',
    q: 'متى يتوفر التطبيق؟',
    a: ['حارتنا في مرحلة ما قبل الإطلاق على App Store لأجهزة iPhone. سنعلن هنا عند توفره.'],
  },
  {
    id: 'create-account',
    category: 'account',
    q: 'كيف أنشئ حساباً؟',
    a: [
      'يمكنك التسجيل بالبريد الإلكتروني وكلمة مرور (٨ أحرف على الأقل وتحتوي على حروف وأرقام)، أو عبر «تسجيل الدخول باستخدام Apple» أو Google.',
      'عند التسجيل بالبريد نرسل لك رابط تأكيد؛ افتحه من جهازك لتفعيل الحساب، ثم أكمل ملفك الشخصي واختر حيّك.',
    ],
  },
  {
    id: 'no-confirmation-email',
    category: 'account',
    q: 'لم يصلني بريد التأكيد',
    a: [
      'تحقق من مجلد الرسائل غير المرغوب فيها، وتأكد من كتابة البريد بشكل صحيح. يمكنك طلب رابط جديد من شاشة «تحقق من بريدك» في التطبيق.',
      'إذا لم يصل بعد عدة دقائق، أرسل لنا طلباً من نموذج الدعم بموضوع «الحساب وتسجيل الدخول».',
    ],
  },
  {
    id: 'forgot-password',
    category: 'account',
    q: 'نسيت كلمة المرور',
    a: [
      'في شاشة تسجيل الدخول اضغط «نسيت كلمة المرور؟» واكتب بريدك، وسيصلك رابط لتعيين كلمة مرور جديدة. إذا سجلت عبر Apple أو Google فاستخدم الزر نفسه لتسجيل الدخول.',
    ],
  },
  {
    id: 'language',
    category: 'account',
    q: 'هل يدعم التطبيق الإنجليزية؟',
    a: ['نعم. التطبيق يدعم العربية والإنجليزية، ويمكنك تغيير اللغة والمظهر (فاتح أو داكن) من الإعدادات.'],
  },
  {
    id: 'choose-neighborhood',
    category: 'verification',
    q: 'كيف أختار حيّي؟',
    a: ['بعد إنشاء الحساب تختار المنطقة ثم المدينة ثم الحي من القائمة الرسمية لأحياء المملكة، ويمكنك البحث باسم الحي.'],
  },
  {
    id: 'why-verify',
    category: 'verification',
    q: 'لماذا أحتاج لتوثيق سكني؟',
    a: [
      'محتوى كل حي يظهر لسكانه فقط، والتوثيق يحمي الجيران من الغرباء. عند الضغط على «توثيق» يطلب التطبيق موقعك مرة واحدة أثناء الاستخدام، ويتحقق الخادم أنك داخل حدود الحي الرسمية.',
      'نحفظ نتيجة التحقق فقط ولا نحفظ إحداثياتك. التوثيق لا يثبت الإقامة الدائمة ولا يكشف عنوانك لأحد.',
    ],
  },
  {
    id: 'verification-failed',
    category: 'verification',
    q: 'التوثيق يقول إنني خارج الحي',
    a: [
      'تأكد أنك موجود فعلاً داخل حدود الحي، وأن إذن الموقع لحارتنا هو «أثناء استخدام التطبيق» مع تفعيل «الموقع الدقيق» في إعدادات iPhone. جرّب في مكان مفتوح أو قرب نافذة ثم أعد المحاولة.',
      'إذا كنت متأكداً أنك داخل الحي، أرسل طلباً بموضوع «توثيق الحي» واذكر اسم الحي والمدينة، وسيراجعه فريق حارتنا. لا نطلب صور الهوية.',
    ],
  },
  {
    id: 'who-sees-my-info',
    category: 'privacy',
    q: 'من يرى بياناتي؟',
    a: [
      'يرى سكان حيّك الموثّقون ما تنشره في الحي. لا يظهر عنوانك أو موقعك الدقيق أو رقم جوالك أو بريدك أو تاريخ ميلادك لأي أحد. قائمة جيرانك خاصة بك.',
      'تتحكم من الإعدادات ← «الجيران والخصوصية» في ظهورك في «اكتشف الجيران» (مغلق افتراضياً)، واستقبال طلبات الجيرة والرسائل، وما يظهر من اهتماماتك.',
    ],
  },
  {
    id: 'tracking',
    category: 'privacy',
    q: 'هل يتتبع حارتنا موقعي أو يعرض إعلانات؟',
    a: [
      'لا. لا نستخدم الموقع في الخلفية، ولا توجد إعلانات أو أدوات تحليل أو تتبع من أطراف ثالثة في التطبيق أو الموقع. التفاصيل في سياسة الخصوصية.',
    ],
  },
  {
    id: 'my-data',
    category: 'privacy',
    q: 'كيف أطلب نسخة من بياناتي أو تصحيحها؟',
    a: [
      'يمكنك تعديل ملفك الشخصي من التطبيق في أي وقت. لطلب نسخة من بياناتك أو أي طلب آخر يتعلق بالخصوصية، أرسل طلباً بموضوع «الخصوصية والبيانات».',
    ],
  },
  {
    id: 'add-neighbor',
    category: 'messaging',
    q: 'كيف أضيف جاراً؟',
    a: ['افتح الملف الشخصي لأحد سكان حيّك واضغط «إضافة جار». تصبحان جيراناً عندما يقبل الطلب. يمكنك إلغاء الطلب أو إزالة الجار في أي وقت.'],
  },
  {
    id: 'who-can-message',
    category: 'messaging',
    q: 'من يستطيع مراسلتي؟',
    a: [
      'الجيران الذين قبلت طلبهم (إذا سمحت بالرسائل في إعدادات الخصوصية)، ومن يتواصل معك بخصوص نشاط أو إعلان أو طلب فزعة أو مفقودات نشرته. لأعضاء كل نادٍ دردشة خاصة بهم.',
      'الرسائل الخاصة لا يراها إلا أطراف المحادثة، وقد يطّلع عليها فريق حارتنا فقط عند مراجعة بلاغ عنها.',
    ],
  },
  {
    id: 'notifications',
    category: 'messaging',
    q: 'كيف تصلني الإشعارات؟',
    a: [
      'تظهر الإشعارات داخل التطبيق في صفحة الإشعارات، مثل طلبات الجيرة والرسائل والردود. لا يرسل حارتنا حالياً إشعارات فورية إلى شاشة الجهاز.',
    ],
  },
  {
    id: 'report',
    category: 'safety',
    q: 'كيف أبلّغ عن محتوى أو حساب مسيء؟',
    a: [
      'اضغط على زر الخيارات (⋯) في المنشور أو التعليق أو الرسالة أو الملف الشخصي أو النشاط أو الإعلان أو النادي، واختر «إبلاغ» ثم السبب.',
      'يراجع فريق حارتنا البلاغات ويهدف للتعامل معها خلال ٢٤ ساعة، وقد يحذف المحتوى أو يوقف الحساب المخالف. يمكنك أيضاً إرسال «بلاغ سلامة» من نموذج الدعم.',
    ],
  },
  {
    id: 'filter',
    category: 'safety',
    q: 'كيف يحمي حارتنا المجتمع من الإساءة؟',
    a: [
      'المحتوى متاح لسكان الحي الموثّقين فقط، والكلمات المسيئة تُصفّى في الخادم قبل النشر، والأندية لا تظهر إلا بعد مراجعة فريق حارتنا، ومنظمو الأندية يجب أن يكونوا ١٨ سنة فأكثر. ونطلب من الجميع الالتزام بإرشادات المجتمع.',
    ],
  },
  {
    id: 'block',
    category: 'blocking',
    q: 'كيف أحظر شخصاً؟',
    a: [
      'افتح ملفه الشخصي، اضغط (⋯) واختر «حظر». يتوقف التواصل بينكما ولا يستطيع مراسلتك أو إرسال طلب جيرة لك، وتُزال الجيرة بينكما إن وجدت.',
    ],
  },
  {
    id: 'delete-how',
    category: 'deletion',
    q: 'كيف أحذف حسابي؟',
    a: [
      'من التطبيق: الملف الشخصي ← الإعدادات ← «حذف الحساب» ثم التأكيد. يُحذف الحساب فوراً وتُسجَّل خارجاً، ولا يمكن التراجع.',
      'إذا لم تستطع فتح التطبيق، أرسل طلباً بموضوع «حذف الحساب» من البريد المسجّل في حسابك.',
    ],
  },
  {
    id: 'delete-what',
    category: 'deletion',
    q: 'ماذا يُحذف عند حذف الحساب؟',
    a: [
      'ملفك الشخصي وصورتك واهتماماتك وإعداداتك، ومنشوراتك وتعليقاتك والأنشطة التي تنظمها وإعلاناتك وطلباتك، والرسائل التي أرسلتها، والبلاغات التي قدّمتها، والصور التي رفعتها، وعلاقات الجيرة. الأندية التي تنظمها تنتقل لعضو بالغ أو تُؤرشف. التفاصيل في صفحة حذف الحساب.',
    ],
  },
  {
    id: 'app-not-working',
    category: 'troubleshooting',
    q: 'التطبيق لا يعمل كما يجب',
    a: [
      'تأكد من اتصالك بالإنترنت (يعرض التطبيق تنبيهاً عند انقطاعه)، وحدّث التطبيق لآخر إصدار، ثم أغلقه وافتحه من جديد. إذا استمرت المشكلة، سجّل الخروج ثم الدخول.',
      'إذا لم تُحل، أرسل طلباً بموضوع «مشكلة تقنية» واذكر طراز جهازك وإصدار iOS وما الذي حدث بالضبط.',
    ],
  },
  {
    id: 'map-photos',
    category: 'troubleshooting',
    q: 'لا أستطيع إضافة صورة أو الخريطة لا تظهر',
    a: [
      'للصور: اسمح لحارتنا بالوصول إلى الصور من إعدادات iPhone ← حارتنا. يختار التطبيق الصور التي تحددها فقط. للخريطة: تأكد من الاتصال بالإنترنت ثم أعد فتح الصفحة.',
    ],
  },
  {
    id: 'suggest',
    category: 'feedback',
    q: 'لدي اقتراح أو ميزة أتمناها',
    a: [
      'يسعدنا ذلك. أرسل اقتراحك من نموذج الدعم بموضوع «سؤال عام» أو من التطبيق: الإعدادات ← «تواصل مع الدعم». نقرأ كل الاقتراحات، ولا نعد بتنفيذ ميزة معينة أو بموعد لها.',
    ],
  },
];

const en: FaqItem[] = [
  {
    id: 'what-is-haratna',
    category: 'about',
    q: 'What is Haratna?',
    a: [
      'Haratna is a neighborhood app for Saudi Arabia. It gives the residents of each neighborhood their own space: local news and announcements, activities and clubs, community help, lost & found, a neighborhood marketplace, polls and private messages between neighbors.',
    ],
  },
  {
    id: 'who-can-join',
    category: 'about',
    q: 'Who can join?',
    a: [
      "Anyone who lives in a neighborhood in Saudi Arabia can create an account. To see and take part in a neighborhood's content you verify that you live there. Creating and running clubs is limited to people aged 18 or over.",
    ],
  },
  {
    id: 'is-it-free',
    category: 'about',
    q: 'Is Haratna free?',
    a: [
      'Yes. There are no in-app purchases, subscriptions or ads. Marketplace deals happen directly between residents; Haratna does not handle payments.',
    ],
  },
  {
    id: 'availability',
    category: 'about',
    q: 'When will the app be available?',
    a: ["Haratna is in pre-launch for iPhone on the App Store. We'll announce it here when it's available."],
  },
  {
    id: 'create-account',
    category: 'account',
    q: 'How do I create an account?',
    a: [
      'Sign up with your email and a password (at least 8 characters, with letters and numbers), or use Sign in with Apple or Google.',
      'With email we send you a confirmation link; open it on your device to activate the account, then complete your profile and choose your neighborhood.',
    ],
  },
  {
    id: 'no-confirmation-email',
    category: 'account',
    q: "I didn't get the confirmation email",
    a: [
      'Check your spam folder and that the address is spelled correctly. You can ask for a new link from the "Check your email" screen in the app.',
      'If it still has not arrived after a few minutes, send us a request with the topic "Account and sign-in".',
    ],
  },
  {
    id: 'forgot-password',
    category: 'account',
    q: 'I forgot my password',
    a: [
      'On the sign-in screen tap "Forgot password?", enter your email and we will send a link to set a new password. If you signed up with Apple or Google, use that same button to sign in.',
    ],
  },
  {
    id: 'language',
    category: 'account',
    q: 'Is the app available in English?',
    a: ['Yes. The app supports Arabic and English, and you can change the language and the appearance (light or dark) in Settings.'],
  },
  {
    id: 'choose-neighborhood',
    category: 'verification',
    q: 'How do I choose my neighborhood?',
    a: [
      'After creating your account, pick your region, then your city, then your neighborhood from the official list of neighborhoods in Saudi Arabia. You can search by neighborhood name.',
    ],
  },
  {
    id: 'why-verify',
    category: 'verification',
    q: 'Why do I need to verify where I live?',
    a: [
      "Each neighborhood's content is visible only to its residents, and verification keeps strangers out. When you tap Verify, the app asks for your location once while you use it, and our server checks that you are inside the official neighborhood boundary.",
      'We store only the result, not your coordinates. Verification does not prove permanent residence and never reveals your address to anyone.',
    ],
  },
  {
    id: 'verification-failed',
    category: 'verification',
    q: 'Verification says I am outside the neighborhood',
    a: [
      'Make sure you are actually inside the neighborhood boundary, that Haratna\'s location permission is "While Using the App", and that Precise Location is on in iPhone Settings. Try outdoors or near a window, then try again.',
      'If you are sure you are inside the neighborhood, send a request with the topic "Neighborhood verification", including your neighborhood and city, and the Haratna team will review it. We never ask for ID photos.',
    ],
  },
  {
    id: 'who-sees-my-info',
    category: 'privacy',
    q: 'Who can see my information?',
    a: [
      'Verified residents of your neighborhood see what you post there. Your address, exact location, phone number, email and date of birth are never shown to anyone. Your neighbor list is private to you.',
      'In Settings → Neighbors & privacy you control whether you appear in Discover Neighbors (off by default), who can send you neighbor requests and messages, and whether your interests are shown.',
    ],
  },
  {
    id: 'tracking',
    category: 'privacy',
    q: 'Does Haratna track my location or show ads?',
    a: [
      'No. Location is never used in the background, and neither the app nor the website contains ads or third-party analytics or tracking. See the Privacy Policy for details.',
    ],
  },
  {
    id: 'my-data',
    category: 'privacy',
    q: 'How do I get a copy of my data or correct it?',
    a: [
      'You can edit your profile in the app at any time. To ask for a copy of your data or make any other privacy request, send a request with the topic "Privacy and data".',
    ],
  },
  {
    id: 'add-neighbor',
    category: 'messaging',
    q: 'How do I add a neighbor?',
    a: [
      'Open the profile of a resident of your neighborhood and tap Add Neighbor. You become neighbors when they accept. You can cancel the request or remove a neighbor at any time.',
    ],
  },
  {
    id: 'who-can-message',
    category: 'messaging',
    q: 'Who can message me?',
    a: [
      'Neighbors whose request you accepted (if you allow messages in your privacy settings), and people contacting you about an activity, listing, help request or lost & found post you published. Each club has a members-only chat.',
      'Private messages are visible only to the people in the conversation; the Haratna team may see a message only when reviewing a report about it.',
    ],
  },
  {
    id: 'notifications',
    category: 'messaging',
    q: 'How do I get notifications?',
    a: [
      "Notifications appear inside the app on the notifications screen, for example neighbor requests, messages and replies. Haratna does not currently send push notifications to your phone's lock screen.",
    ],
  },
  {
    id: 'report',
    category: 'safety',
    q: 'How do I report abusive content or an account?',
    a: [
      'Tap the options button (⋯) on the post, comment, message, profile, activity, listing or club, choose Report and pick a reason.',
      'The Haratna team reviews reports and aims to act within 24 hours; it may remove the content or suspend the account. You can also send a "Safety report" from the support form.',
    ],
  },
  {
    id: 'filter',
    category: 'safety',
    q: 'How does Haratna protect the community from abuse?',
    a: [
      'Content is visible only to verified residents of the neighborhood, abusive words are filtered on the server before anything is posted, clubs appear only after the Haratna team reviews them, and club organizers must be 18 or older. Everyone is asked to follow the Community Guidelines.',
    ],
  },
  {
    id: 'block',
    category: 'blocking',
    q: 'How do I block someone?',
    a: [
      'Open their profile, tap ⋯ and choose Block. Contact between you stops: they can no longer message you or send you a neighbor request, and you are no longer neighbors.',
    ],
  },
  {
    id: 'delete-how',
    category: 'deletion',
    q: 'How do I delete my account?',
    a: [
      'In the app: Profile → Settings → Delete account, then confirm. The account is deleted immediately and you are signed out. This cannot be undone.',
      'If you cannot open the app, send a request with the topic "Account deletion" from the email address of your account.',
    ],
  },
  {
    id: 'delete-what',
    category: 'deletion',
    q: 'What is deleted when I delete my account?',
    a: [
      'Your profile, photo, interests and settings; your posts, comments, activities you host, listings and requests; messages you sent, reports you filed, photos you uploaded and your neighbor connections. Clubs you organize pass to an adult member or are archived. Details are on the account deletion page.',
    ],
  },
  {
    id: 'app-not-working',
    category: 'troubleshooting',
    q: "The app isn't working properly",
    a: [
      'Check your internet connection (the app shows a notice when you are offline), update to the latest version, then close and reopen the app. If the problem continues, sign out and sign back in.',
      'If that does not fix it, send a request with the topic "Technical issue" with your device model, iOS version and exactly what happened.',
    ],
  },
  {
    id: 'map-photos',
    category: 'troubleshooting',
    q: "I can't add a photo, or the map doesn't load",
    a: [
      'For photos: allow Haratna to access photos in iPhone Settings → Haratna. The app only uses the photos you pick. For the map: check your internet connection and reopen the screen.',
    ],
  },
  {
    id: 'suggest',
    category: 'feedback',
    q: 'I have an idea or a feature request',
    a: [
      'We would love to hear it. Send it from the support form with the topic "General question", or in the app: Settings → Contact support. We read every suggestion, but we cannot promise a specific feature or date.',
    ],
  },
];

export const FAQ: Record<Locale, FaqItem[]> = { ar, en };
export const HOME_FAQ_IDS = ['what-is-haratna', 'who-can-join', 'why-verify', 'who-sees-my-info', 'delete-how'];
