import { MISSING_LAUNCH_DETAILS } from './legal';

/**
 * The public origin. Set NEXT_PUBLIC_SITE_URL once the domain is live. On a
 * Vercel preview without it, the deployment's own URL is used so links in
 * metadata still resolve.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Search engines only index the site once the domain and the owner's legal
 * details are in place; before that every page is a pre-launch preview.
 */
export const isLaunchReady = (): boolean => Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()) && MISSING_LAUNCH_DETAILS.length === 0;
