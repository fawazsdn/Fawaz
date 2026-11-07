import type { MetadataRoute } from 'next';

import { isLaunchReady, siteUrl } from '@/lib/site';

/** Until the domain and owner details are configured, the preview asks crawlers to stay away. */
export default function robots(): MetadataRoute.Robots {
  if (!isLaunchReady()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
