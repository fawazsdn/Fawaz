import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { mockDelay } from '../shared';
import type { ReferralService, ReferralMilestone } from './ReferralService';

const MILESTONES: ReferralMilestone[] = [
  { key: 'connector', threshold: 3, titleAr: 'الرابط', titleEn: 'Connector' },
  { key: 'ambassador', threshold: 10, titleAr: 'سفير الحي', titleEn: 'Neighborhood Ambassador' },
  { key: 'founding', threshold: 25, titleAr: 'جار مؤسس', titleEn: 'Founding Neighbor' },
  { key: 'builder', threshold: 50, titleAr: 'باني المجتمع', titleEn: 'Community Builder' },
];

/** A short, stable, non-guessable-enough-for-a-demo code derived from the
 * user id — good enough for a mock invite link; a real backend would issue
 * a proper opaque referral code server-side. */
function codeFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return hash.toString(36).toUpperCase().slice(0, 6).padEnd(6, '0');
}

export const mockReferralService: ReferralService = {
  async getReferralCode() {
    return mockDelay(codeFor(CURRENT_USER_ID), 80);
  },
  async getStats() {
    return mockDelay(useStore.getState().referral);
  },
  async recordInviteSent() {
    useStore.getState().recordReferralInviteSent();
    return mockDelay(useStore.getState().referral, 80);
  },
  async getMilestones() {
    return mockDelay(MILESTONES, 80);
  },
};
