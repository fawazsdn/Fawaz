import localFont from 'next/font/local';

/** Self-hosted brand fonts (SIL Open Font License), shared by the public site and the admin area. */
export const tajawal = localFont({
  src: [
    { path: '../fonts/Tajawal_400Regular.ttf', weight: '400' },
    { path: '../fonts/Tajawal_500Medium.ttf', weight: '500' },
    { path: '../fonts/Tajawal_700Bold.ttf', weight: '700' },
    { path: '../fonts/Tajawal_800ExtraBold.ttf', weight: '800' },
  ],
  variable: '--font-tajawal',
  display: 'swap',
});

export const jakarta = localFont({
  src: [
    { path: '../fonts/PlusJakartaSans_400Regular.ttf', weight: '400' },
    { path: '../fonts/PlusJakartaSans_600SemiBold.ttf', weight: '600' },
    { path: '../fonts/PlusJakartaSans_700Bold.ttf', weight: '700' },
    { path: '../fonts/PlusJakartaSans_800ExtraBold.ttf', weight: '800' },
  ],
  variable: '--font-jakarta',
  display: 'swap',
});
