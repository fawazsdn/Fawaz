import path from 'node:path';
import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Next.js needs inline scripts for hydration; everything else is same-origin.
// The site loads no third-party scripts, fonts, analytics or trackers.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isProd ? '' : ' ws:'}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** Stable short URLs (for App Store Connect) that open the Arabic page by default. */
const SHORT = ['support', 'privacy', 'terms', 'guidelines', 'delete-account', 'contact', 'faq'];

const config: NextConfig = {
  poweredByHeader: false,
  // web/ is its own project inside the app repository.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: true,
  experimental: { globalNotFound: true },
  images: { formats: ['image/avif', 'image/webp'] },
  async redirects() {
    return [
      { source: '/', destination: '/ar', permanent: false },
      ...SHORT.map((p) => ({ source: `/${p}`, destination: `/ar/${p}`, permanent: false })),
      { source: '/help', destination: '/ar/support', permanent: false },
      { source: '/privacy-policy', destination: '/ar/privacy', permanent: false },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ];
  },
};

export default config;
