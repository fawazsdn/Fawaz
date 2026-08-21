import type { ReferralStats } from '@/models';

export interface ReferralMilestone {
  key: string;
  threshold: number;
  titleAr: string;
  titleEn: string;
}

/**
 * WhatsApp-first neighborhood growth loop, all local/mock in this
 * frontend-only build (see MockReferralService). `invitesSent` reflects
 * real taps on a share action on this device; `joinedCount` is seeded
 * demo data, since knowing whether someone actually joined via a link
 * requires a backend this app doesn't have yet. Never treat either number
 * as secure or server-authoritative until a real implementation replaces
 * this service — see docs/PRIVACY-DATA-MAP.md.
 */
export interface ReferralService {
  /** A stable per-resident invite code, embedded in their share link. */
  getReferralCode(): Promise<string>;
  getStats(): Promise<ReferralStats>;
  /** Call when the user actually taps a share action (WhatsApp, native
   * share, copy link) — increments the one number this device can
   * honestly observe. */
  recordInviteSent(): Promise<ReferralStats>;
  getMilestones(): Promise<ReferralMilestone[]>;
}
