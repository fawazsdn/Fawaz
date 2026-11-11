import { supabase } from '@/lib/supabase';
import { useSocialStore } from '../socialState';
import { ActionError, approximateCoordinate, createEvent, createPost, deleteAccount } from '@/backend/actions';
import { resetStoreForTests, signInVerifiedForTests, TEST_ME, TEST_NEIGHBORHOOD_ID } from '@/testing/fixtures';
import { requestAppleDeletionCode } from '@/features/auth/supabaseAuth';
import { useStore } from '@/store/useStore';
import { groupActivities } from '../../../app/events';
import type { CommunityEvent } from '@/models';

jest.mock('@/backend/sync', () => ({ requestSync: jest.fn(async () => {}) }));

jest.mock('@/features/auth/supabaseAuth', () => ({
  ...jest.requireActual('@/features/auth/supabaseAuth'),
  requestAppleDeletionCode: jest.fn(),
}));

describe('account deletion rollout', () => {
  const authorize = jest.mocked(requestAppleDeletionCode);
  const invoke = jest.mocked(supabase.functions.invoke);

  beforeEach(() => {
    signInVerifiedForTests();
    jest.clearAllMocks();
  });

  it('sends Apple deletion only to the revocation-capable endpoint', async () => {
    authorize.mockResolvedValueOnce('fresh-code');
    invoke.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    await expect(deleteAccount()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('delete-account-v2', {
      method: 'POST',
      body: { appleAuthorizationCode: 'fresh-code' },
    });
  });

  it('sends accounts without Apple to the same reviewed v2 endpoint (it also removes private photos)', async () => {
    authorize.mockResolvedValueOnce(undefined);
    invoke.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    await expect(deleteAccount()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('delete-account-v2', { method: 'POST' });
    expect(invoke).not.toHaveBeenCalledWith('delete-account', expect.anything());
  });

  it('leaves the account signed in and sends no request when Apple is cancelled', async () => {
    authorize.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    await expect(deleteAccount()).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(useStore.getState().session.supabaseUserId).toBe(TEST_ME);
  });

  it('does not fall back to legacy deletion after a revocation failure', async () => {
    authorize.mockResolvedValueOnce('fresh-code');
    invoke.mockResolvedValueOnce({ data: null, error: new Error('Apple revocation failed') });
    await expect(deleteAccount()).rejects.toBeInstanceOf(ActionError);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(useStore.getState().session.supabaseUserId).toBe(TEST_ME);
  });
});

describe('actions', () => {
  beforeEach(() => {
    (supabase.from as jest.Mock).mockClear();
    (supabase.rpc as jest.Mock).mockClear();
  });

  it('rounds coordinates to ~110 m so exact homes are never published', () => {
    expect(approximateCoordinate(26.250447215)).toBe(26.25);
    expect(approximateCoordinate(50.0595283)).toBe(50.06);
  });

  it('refuses to create content for unverified residents (RLS would refuse too)', async () => {
    resetStoreForTests();
    useStore.getState().setSupabaseAuth(TEST_ME, 'email', null);
    useStore.getState().patchSession({ neighborhoodId: TEST_NEIGHBORHOOD_ID, verification: 'pending' });
    await expect(createPost({ type: 'general', textAr: 'hi', localImages: [], audience: 'neighborhood' })).rejects.toMatchObject({
      code: 'not_verified',
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('creates a real activity row in the resident’s neighborhood, then RSVPs the organizer', async () => {
    signInVerifiedForTests();
    const insert = jest.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'evt-1' }, error: null }) }) }));
    (supabase.from as jest.Mock).mockImplementationOnce(() => ({ insert }));
    const id = await createEvent({
      kind: 'activity',
      occasion: 'ramadan',
      title: 'Ramadan football',
      category: 'football',
      description: '',
      startsAt: '2026-10-20T16:00:00.000Z',
      endsAt: '2026-10-20T17:30:00.000Z',
      locationLabel: 'Ajyal park',
      coordinate: { lat: 26.250447, lng: 50.059528 },
      capacity: 12,
      audience: 'neighborhood',
      recurring: false,
    });
    expect(id).toBe('evt-1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        neighborhood_id: TEST_NEIGHBORHOOD_ID,
        host_id: TEST_ME,
        kind: 'activity',
        occasion: 'ramadan',
        starts_at: '2026-10-20T16:00:00.000Z',
        approx_lat: 26.25,
        approx_lng: 50.06,
        cover_image_path: null,
      }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith('rsvp_event', { target_event_id: 'evt-1', desired_status: 'going' });
  });

  it('wraps server errors as typed ActionErrors', async () => {
    signInVerifiedForTests();
    useSocialStore.setState({ available: true, exactlyOnce: true });
    (supabase.rpc as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }),
    );
    const err = await createPost({ type: 'general', textAr: 'x', localImages: [], audience: 'neighborhood' }).catch((e) => e);
    expect(err).toBeInstanceOf(ActionError);
    expect(err.code).toBe('forbidden');
  });
});

describe('Activities page sections', () => {
  const now = new Date('2026-10-12T09:00:00Z'); // noon Riyadh
  const ev = (id: string, startsAt: string, going = 0, extra: Partial<CommunityEvent> = {}): CommunityEvent => ({
    id,
    kind: 'activity',
    title: id,
    category: 'football',
    description: '',
    hostId: TEST_ME,
    neighborhoodId: TEST_NEIGHBORHOOD_ID,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
    locationLabel: 'x',
    capacity: 10,
    audience: 'neighborhood',
    recurring: false,
    recurrence: 'none',
    membersOnly: false,
    attendees: Array.from({ length: going }, (_, i) => ({ userId: `u${i}`, status: 'going' as const, joinedAt: startsAt })),
    ...extra,
  });

  it('groups into today / this week / upcoming / past, and features only real popular ones', () => {
    const g = groupActivities(
      [
        ev('today', '2026-10-12T16:00:00Z', 5),
        ev('week', '2026-10-15T16:00:00Z', 0),
        ev('later', '2026-11-01T16:00:00Z', 3),
        ev('past', '2026-10-01T16:00:00Z', 9),
        ev('cancelled', '2026-10-12T17:00:00Z', 9, { cancelled: true }),
      ],
      now,
    );
    expect(g.today.map((e) => e.id)).toEqual(['today']);
    expect(g.thisWeek.map((e) => e.id)).toEqual(['week']);
    expect(g.upcoming.map((e) => e.id)).toEqual(['later']);
    expect(g.past.map((e) => e.id)).toEqual(['past']);
    expect(g.featured.map((e) => e.id)).toEqual(['today', 'later']);
  });
});
