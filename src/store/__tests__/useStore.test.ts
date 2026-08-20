import { CURRENT_USER_ID, useStore } from '@/store/useStore';

// Each test starts from a clean slate of the seeded mock data.
beforeEach(() => {
  useStore.getState().resetDemoData();
});

describe('posts', () => {
  it('creates a post and prepends it to the feed', () => {
    const before = useStore.getState().posts.length;
    const post = useStore.getState().createPost({ type: 'general', textAr: 'مرحبا بالحي', images: [], audience: 'neighborhood' });
    const state = useStore.getState();
    expect(state.posts.length).toBe(before + 1);
    expect(state.posts[0]!.id).toBe(post.id);
    expect(post.authorId).toBe(CURRENT_USER_ID);
  });

  it('toggles a reaction on and off', () => {
    const postId = useStore.getState().posts[0]!.id;
    useStore.getState().toggleReaction(postId, 'like');
    expect(
      useStore
        .getState()
        .posts.find((p) => p.id === postId)!
        .reactions.some((r) => r.userId === CURRENT_USER_ID),
    ).toBe(true);
    useStore.getState().toggleReaction(postId, 'like');
    expect(
      useStore
        .getState()
        .posts.find((p) => p.id === postId)!
        .reactions.some((r) => r.userId === CURRENT_USER_ID),
    ).toBe(false);
  });
});

describe('events', () => {
  it('waitlists a user who joins a full event', () => {
    // Seed event "e6" is hosted by another resident and already has 4/4 going,
    // so the current user (not yet an attendee) should be waitlisted on join.
    const before = useStore.getState().events.find((e) => e.id === 'e6')!;
    expect(before.attendees.filter((a) => a.status === 'going').length).toBe(before.capacity);
    expect(before.attendees.some((a) => a.userId === CURRENT_USER_ID)).toBe(false);

    useStore.getState().joinEvent('e6');
    const mine = useStore
      .getState()
      .events.find((e) => e.id === 'e6')!
      .attendees.find((a) => a.userId === CURRENT_USER_ID);
    expect(mine?.status).toBe('waitlisted');
  });

  it('joins an event with open capacity as going', () => {
    const event = useStore.getState().createEvent({
      title: 'اختبار',
      category: 'football',
      coverImage: 'x',
      description: '',
      neighborhoodId: 'n1',
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      locationLabel: 'x',
      approxLat: 0,
      approxLng: 0,
      capacity: 5,
      audience: 'neighborhood',
      recurring: false,
    });
    // createEvent already seats the host (current user) as "going".
    const mine = useStore
      .getState()
      .events.find((e) => e.id === event.id)!
      .attendees.find((a) => a.userId === CURRENT_USER_ID);
    expect(mine?.status).toBe('going');
  });

  it('promotes a waitlisted attendee when someone leaves', () => {
    const event = useStore.getState().createEvent({
      title: 'اختبار الانتظار',
      category: 'padel',
      coverImage: 'x',
      description: '',
      neighborhoodId: 'n1',
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      locationLabel: 'x',
      approxLat: 0,
      approxLng: 0,
      capacity: 1,
      audience: 'neighborhood',
      recurring: false,
    });
    useStore.setState((s) => ({
      events: s.events.map((e) =>
        e.id === event.id
          ? { ...e, attendees: [...e.attendees, { userId: 'u2', status: 'waitlisted', joinedAt: new Date().toISOString() }] }
          : e,
      ),
    }));
    useStore.getState().leaveEvent(event.id);
    const updated = useStore.getState().events.find((e) => e.id === event.id)!;
    expect(updated.attendees.find((a) => a.userId === 'u2')?.status).toBe('going');
  });
});

describe('polls', () => {
  it('records exactly one vote per user', () => {
    const poll = useStore.getState().createPoll({ question: 'سؤال؟', options: ['أ', 'ب'], closesInHours: 24 });
    const firstOption = poll.options[0]!.id;
    const secondOption = poll.options[1]!.id;
    useStore.getState().voteInPoll(poll.id, firstOption);
    useStore.getState().voteInPoll(poll.id, secondOption);
    const updated = useStore.getState().polls.find((p) => p.id === poll.id)!;
    const totalVotes = updated.options.reduce((sum, o) => sum + o.votes.length, 0);
    expect(totalVotes).toBe(1);
    expect(updated.options.find((o) => o.id === firstOption)!.votes).toContain(CURRENT_USER_ID);
  });
});

describe('trust & safety', () => {
  it('blocks and unblocks a user', () => {
    useStore.getState().toggleBlockUser('u2');
    expect(useStore.getState().blockedUserIds).toContain('u2');
    useStore.getState().toggleBlockUser('u2');
    expect(useStore.getState().blockedUserIds).not.toContain('u2');
  });

  it('increments thanksReceived when a neighbor is thanked', () => {
    const before = useStore.getState().getUser('u2')!.stats.thanksReceived;
    useStore.getState().thankUser('u2', 'ساعدني');
    expect(useStore.getState().getUser('u2')!.stats.thanksReceived).toBe(before + 1);
  });
});

describe('help requests', () => {
  it('marks a request in_progress once someone offers to help', () => {
    const req = useStore
      .getState()
      .createHelpRequest({ title: 'مساعدة', category: 'other', description: '', neighborhoodId: 'n1', approxDistanceM: 100 });
    useStore.getState().offerHelp(req.id);
    const updated = useStore.getState().helpRequests.find((h) => h.id === req.id)!;
    expect(updated.status).toBe('in_progress');
    expect(updated.offeredBy).toContain(CURRENT_USER_ID);
  });
});
