import { useStore } from '@/store/useStore';
import { referralService } from '../index';

beforeEach(() => {
  useStore.getState().resetDemoData();
});

describe('referral service', () => {
  it('exposes the exact approved milestone thresholds and names', async () => {
    const milestones = await referralService.getMilestones();
    expect(milestones.map((m) => [m.threshold, m.titleEn])).toEqual([
      [3, 'Connector'],
      [10, 'Neighborhood Ambassador'],
      [25, 'Founding Neighbor'],
      [50, 'Community Builder'],
    ]);
  });

  it('returns a stable referral code for the current user', async () => {
    const a = await referralService.getReferralCode();
    const b = await referralService.getReferralCode();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('increments invitesSent only when a share is actually recorded', async () => {
    const before = useStore.getState().referral.invitesSent;
    await referralService.recordInviteSent();
    expect(useStore.getState().referral.invitesSent).toBe(before + 1);
  });
});
