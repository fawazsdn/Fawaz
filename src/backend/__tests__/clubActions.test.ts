import { supabase } from '@/lib/supabase';
import { signInVerifiedForTests } from '@/testing/fixtures';
import { ActionError, joinClub, reviewClub, submitClubApplication } from '../actions';
import { mapClub, mapEvent } from '../sync';

jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
  signInVerifiedForTests();
});

const application = {
  name: 'Morning Runners',
  description: 'Easy group runs around the park for all levels.',
  category: 'running' as const,
  purpose: 'Help neighbors stay active and meet each other.',
  plannedActivities: 'Weekly 5km runs',
  meetingFrequency: 'weekly',
  neighborhoodBenefit: 'Neighbors meet regularly, exercise together and make the park livelier.',
  rules: 'Be kind and punctual.',
  membershipType: 'approval' as const,
};

describe('club actions', () => {
  it('submits an application without any review status, owner or neighborhood (the server decides those)', async () => {
    rpc.mockResolvedValue({ data: 'club-1', error: null });
    await expect(submitClubApplication(application)).resolves.toBe('club-1');
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('submit_club_application');
    expect(args.p).not.toHaveProperty('review_status');
    expect(args.p).not.toHaveProperty('neighborhood_id');
    expect(args.p).not.toHaveProperty('owner_id');
    expect(args.p.custom_category).toBeNull();
  });

  it('surfaces the server reason (e.g. under 18, rate limited) as a typed error', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not_adult' } });
    const err = await submitClubApplication(application).catch((e) => e);
    expect(err).toBeInstanceOf(ActionError);
    expect(err.code).toBe('forbidden');
    expect(err.reason).toBe('not_adult');

    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'rate_limited' } });
    const limited = await joinClub('c1').catch((e) => e);
    expect(limited.reason).toBe('rate_limited');
  });

  it('a non-admin review attempt fails on the server and is reported, never assumed successful', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'administrator access required' } });
    const err = await reviewClub('c1', 'approved').catch((e) => e);
    expect(err).toBeInstanceOf(ActionError);
    expect(err.code).toBe('forbidden');
  });
});

describe('sync mapping', () => {
  it('maps club rows, keeping custom categories only for "other"', () => {
    const club = mapClub(
      {
        id: 'c1',
        name: 'Falcon fans',
        description: 'd',
        category: 'other',
        custom_category: 'Falconry',
        neighborhood_id: 'nb',
        owner_id: 'u1',
        membership_type: 'open',
        rules: 'r',
        review_status: 'approved',
        created_at: '2026-10-01T00:00:00Z',
        cover_image_path: 'nb/u1/a.jpg',
      },
      4,
      (p) => (p ? `https://signed/${p}` : undefined),
    );
    expect(club).toMatchObject({
      customCategory: 'Falconry',
      membershipType: 'open',
      memberCount: 4,
      coverImage: 'https://signed/nb/u1/a.jpg',
    });
    expect(mapClub({ id: 'c2', category: 'chess', custom_category: 'x', membership_type: 'weird' }, 0, () => undefined)).toMatchObject({
      customCategory: undefined,
      membershipType: 'approval',
    });
  });

  it('maps club, series and custom-category fields on events', () => {
    const e = mapEvent(
      {
        id: 'e1',
        kind: 'activity',
        category: 'other',
        custom_category: 'Board games',
        club_id: 'c1',
        series_id: 's1',
        recurrence: 'biweekly',
        members_only: true,
        event_attendees: [],
      },
      () => undefined,
    );
    expect(e).toMatchObject({ customCategory: 'Board games', clubId: 'c1', seriesId: 's1', recurrence: 'biweekly', membersOnly: true });
    expect(mapEvent({ id: 'e2', category: 'padel', recurrence: 'nonsense', event_attendees: [] }, () => undefined)).toMatchObject({
      recurrence: 'none',
      membersOnly: false,
      customCategory: undefined,
      clubId: undefined,
    });
  });
});
