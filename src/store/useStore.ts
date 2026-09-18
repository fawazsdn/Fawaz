import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as seed from '@/mocks/seed';
import type {
  AlertItem,
  AppNotification,
  Business,
  BorrowItem,
  Comment,
  CommunityEvent,
  CommunityGroup,
  Conversation,
  DemoRole,
  HelpRequest,
  Institution,
  Issue,
  IssueUpdate,
  ListingType,
  Locale,
  LostFoundPost,
  MarketplaceListing,
  Message,
  Neighborhood,
  Poll,
  Post,
  PostType,
  Recommendation,
  ReferralStats,
  ReportReason,
  ReportTargetType,
  ReputationEvent,
  ThemeMode,
  User,
  VerificationStatus,
} from '@/models';
import type { NeighborhoodSuggestion } from '@/types/geography';
import { uid } from '@/utils/id';

interface Settings {
  locale: Locale;
  themeMode: ThemeMode;
  ramadanMode: boolean;
  demoRole: DemoRole;
  notificationsEnabled: boolean;
  whoCanMessage: 'everyone' | 'neighbors' | 'nobody';
  activityVisible: boolean;
}

interface SessionState {
  onboardingCompleted: boolean;
  phone: string | null;
  otpVerified: boolean;
  profileCreated: boolean;
  /** Real sa-region-* / sa-city-* ids from the Saudi geography dataset. */
  regionId: string | null;
  cityId: string | null;
  neighborhoodId: string | null;
  verification: VerificationStatus;
  isAuthenticated: boolean;
  /** The real Supabase auth.uid() once signed in with Apple/Google — never a client-invented id. */
  supabaseUserId: string | null;
  authProvider: 'apple' | 'google' | 'phone' | null;
}

interface AppState {
  settings: Settings;
  session: SessionState;

  // entities (mutable copies seeded from mocks)
  neighborhoods: Neighborhood[];
  neighborhoodSuggestions: NeighborhoodSuggestion[];
  users: User[];
  posts: Post[];
  comments: Comment[];
  issues: Issue[];
  issueUpdates: IssueUpdate[];
  helpRequests: HelpRequest[];
  events: CommunityEvent[];
  polls: Poll[];
  marketplaceListings: MarketplaceListing[];
  borrowItems: BorrowItem[];
  businesses: Business[];
  recommendations: Recommendation[];
  lostFound: LostFoundPost[];
  conversations: Conversation[];
  messages: Message[];
  notifications: AppNotification[];
  institutions: Institution[];
  alerts: AlertItem[];
  communityGroups: CommunityGroup[];
  reputationEvents: ReputationEvent[];
  blockedUserIds: string[];
  mutedUserIds: string[];
  reports: {
    id: string;
    targetType: ReportTargetType;
    targetId: string;
    reasonType: ReportReason;
    note?: string;
    createdAt: string;
    status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  }[];
  searchHistory: string[];
  /** Recently-selected city ids (most recent first), for onboarding shortcuts. */
  recentCityIds: string[];
  /** Local-only WhatsApp/growth referral stats — see src/services/referral. */
  referral: ReferralStats;

  // -- actions --
  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setRamadanMode: (on: boolean) => void;
  setDemoRole: (role: DemoRole) => void;
  setSettings: (partial: Partial<Settings>) => void;

  completeOnboarding: () => void;
  setPhone: (phone: string) => void;
  verifyOtp: () => void;
  /** Sets the real Supabase auth.uid() after a genuine Apple/Google sign-in. */
  setSupabaseAuth: (userId: string, provider: 'apple' | 'google') => void;
  createProfile: (input: {
    firstName: string;
    lastName: string;
    namePrivacy: User['namePrivacy'];
    bio?: string;
    avatarUrl?: string;
  }) => void;
  selectCity: (params: { regionId: string; cityId: string }) => void;
  addRecentCity: (cityId: string) => void;
  recordReferralInviteSent: () => void;
  selectNeighborhood: (neighborhoodId: string) => void;
  submitNeighborhoodSuggestion: (
    input: Omit<NeighborhoodSuggestion, 'id' | 'createdAt' | 'status'>,
  ) => NeighborhoodSuggestion;
  setVerification: (status: VerificationStatus) => void;
  signOut: () => void;
  resetDemoData: () => void;

  currentUser: () => User;
  getUser: (id: string) => User | undefined;

  createPost: (input: { type: PostType; textAr: string; images: string[]; audience: 'neighborhood' | 'city' }) => Post;
  toggleReaction: (postId: string, type: 'like' | 'helpful') => void;
  toggleSavePost: (postId: string) => void;
  addComment: (postId: string, textAr: string, parentId?: string) => Comment;
  editComment: (commentId: string, textAr: string) => void;
  deleteComment: (commentId: string) => void;
  toggleCommentLike: (commentId: string) => void;
  deletePost: (postId: string) => void;

  createIssue: (input: Omit<Issue, 'id' | 'reporterId' | 'status' | 'affectedUserIds' | 'followerIds' | 'createdAt'>) => Issue;
  markIssueAffected: (issueId: string) => void;
  toggleFollowIssue: (issueId: string) => void;
  setIssueStatus: (issueId: string, status: Issue['status'], note?: string) => void;

  createHelpRequest: (input: Omit<HelpRequest, 'id' | 'requesterId' | 'createdAt' | 'offeredBy' | 'status'>) => HelpRequest;
  offerHelp: (helpRequestId: string) => void;
  resolveHelpRequest: (helpRequestId: string) => void;

  createEvent: (input: Omit<CommunityEvent, 'id' | 'hostId' | 'attendees'>) => CommunityEvent;
  joinEvent: (eventId: string) => void;
  leaveEvent: (eventId: string) => void;
  cancelEvent: (eventId: string) => void;

  voteInPoll: (pollId: string, optionId: string) => void;
  createPoll: (input: { question: string; options: string[]; closesInHours: number }) => Poll;

  createListing: (input: Omit<MarketplaceListing, 'id' | 'sellerId' | 'createdAt' | 'savedBy' | 'status'>) => MarketplaceListing;
  toggleSaveListing: (listingId: string) => void;

  requestBorrow: (itemId: string) => void;

  recommendBusiness: (businessId: string, textAr: string) => void;

  createLostFound: (
    input: Omit<LostFoundPost, 'id' | 'authorId' | 'createdAt' | 'status'> & { status?: LostFoundPost['status'] },
  ) => LostFoundPost;
  markLostFoundStatus: (id: string, status: LostFoundPost['status']) => void;

  sendMessage: (conversationId: string, text: string, image?: string) => Message;
  simulateIncomingMessage: (conversationId: string, senderId: string, text: string) => Message;
  getOrCreateConversation: (otherUserId: string) => Conversation;
  markConversationRead: (conversationId: string) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  thankUser: (userId: string, reasonAr: string, message?: string) => void;

  toggleBlockUser: (userId: string) => void;
  toggleMuteUser: (userId: string) => void;
  submitReport: (targetType: ReportTargetType, targetId: string, reasonType: ReportReason, note?: string) => void;
  moderateReport: (reportId: string, status: 'reviewed' | 'dismissed' | 'actioned') => void;
  removeContent: (targetType: ReportTargetType, targetId: string) => void;

  toggleAlertFollow: (alertId: string) => void;
  toggleAlertHelpful: (alertId: string) => void;

  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
}

const initialSettings: Settings = {
  locale: 'ar',
  themeMode: 'system',
  ramadanMode: false,
  demoRole: 'resident',
  notificationsEnabled: true,
  whoCanMessage: 'neighbors',
  activityVisible: true,
};

const initialSession: SessionState = {
  onboardingCompleted: false,
  phone: null,
  otpVerified: false,
  profileCreated: false,
  regionId: null,
  cityId: null,
  neighborhoodId: null,
  verification: 'not_started',
  isAuthenticated: false,
  supabaseUserId: null,
  authProvider: null,
};

function freshEntities() {
  return {
    neighborhoods: seed.NEIGHBORHOODS,
    neighborhoodSuggestions: [] as NeighborhoodSuggestion[],
    users: structuredClone(seed.USERS) as User[],
    posts: structuredClone([...seed.POSTS, ...seed.POLL_POSTS]) as Post[],
    comments: structuredClone(seed.COMMENTS) as Comment[],
    issues: structuredClone(seed.ISSUES) as Issue[],
    issueUpdates: structuredClone(seed.ISSUE_UPDATES) as IssueUpdate[],
    helpRequests: structuredClone(seed.HELP_REQUESTS) as HelpRequest[],
    events: structuredClone(seed.EVENTS) as CommunityEvent[],
    polls: structuredClone(seed.POLLS) as Poll[],
    marketplaceListings: structuredClone(seed.MARKETPLACE_LISTINGS) as MarketplaceListing[],
    borrowItems: structuredClone(seed.BORROW_ITEMS) as BorrowItem[],
    businesses: structuredClone(seed.BUSINESSES) as Business[],
    recommendations: structuredClone(seed.RECOMMENDATIONS) as Recommendation[],
    lostFound: structuredClone(seed.LOST_FOUND) as LostFoundPost[],
    conversations: structuredClone(seed.CONVERSATIONS) as Conversation[],
    messages: structuredClone(seed.MESSAGES) as Message[],
    notifications: structuredClone(seed.NOTIFICATIONS) as AppNotification[],
    institutions: structuredClone(seed.INSTITUTIONS) as Institution[],
    alerts: structuredClone(seed.ALERTS) as AlertItem[],
    communityGroups: structuredClone(seed.COMMUNITY_GROUPS) as CommunityGroup[],
    reputationEvents: structuredClone(seed.REPUTATION_EVENTS) as ReputationEvent[],
    blockedUserIds: [] as string[],
    mutedUserIds: [] as string[],
    reports: [] as AppState['reports'],
    searchHistory: [] as string[],
    recentCityIds: [] as string[],
    referral: structuredClone(seed.REFERRAL_STATS) as ReferralStats,
  };
}

const CURRENT_USER_ID = seed.CURRENT_USER_ID;

/**
 * The persist middleware's `merge` — pulled out to a named, exported
 * function so it's directly unit-testable (see
 * src/store/__tests__/persistMerge.test.ts) rather than only reachable
 * through a full AsyncStorage-mocked hydration cycle.
 *
 * Runs on every load, regardless of whether the persisted version number
 * matches (unlike zustand's `migrate`, which only fires on an explicit
 * version mismatch) — the one place a persisted session referencing a
 * neighborhood this build no longer has (an id from before the Saudi-
 * geography migration, or one simply renamed or removed since) gets
 * caught. Left unvalidated, Home/Explore/Map resolve nothing for it:
 * Home/Explore rendered a hollow "0 of everything" screen, and Map
 * (which guards on the resolved neighborhood object rather than the id
 * string) went fully blank. Checked against currentState's freshly-
 * seeded neighborhoods (not the persisted ones, which could be the
 * stale part) so a wholesale-outdated persisted entity snapshot can't
 * produce a false "still valid". Only the specific stale id is cleared
 * — everything else in session/settings is preserved — and the new
 * <NoNeighborhoodState /> those screens show now gives a working
 * recovery action either way.
 */
export function mergePersistedState(persistedState: unknown, currentState: AppState): AppState {
  const persisted = persistedState as Partial<AppState> | undefined;
  const merged: AppState = { ...currentState, ...persisted };
  // session/settings are merged one level deep (not just overwritten) so a
  // persisted blob from an older build that predates a new field (e.g.
  // supabaseUserId/authProvider) still gets that field's current default
  // instead of silently ending up undefined.
  if (persisted?.session) merged.session = { ...currentState.session, ...persisted.session };
  if (persisted?.settings) merged.settings = { ...currentState.settings, ...persisted.settings };
  const neighborhoodId = persisted?.session?.neighborhoodId;
  if (neighborhoodId && !currentState.neighborhoods.some((n) => n.id === neighborhoodId)) {
    merged.session = { ...merged.session, neighborhoodId: null };
  }
  return merged;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      session: initialSession,
      ...freshEntities(),

      setLocale: (locale) => set((s) => ({ settings: { ...s.settings, locale } })),
      setThemeMode: (mode) => set((s) => ({ settings: { ...s.settings, themeMode: mode } })),
      setRamadanMode: (on) => set((s) => ({ settings: { ...s.settings, ramadanMode: on } })),
      setDemoRole: (role) =>
        set((s) => ({
          settings: { ...s.settings, demoRole: role },
          users: s.users.map((u) => (u.id === CURRENT_USER_ID ? { ...u, role } : u)),
        })),
      setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),

      completeOnboarding: () => set((s) => ({ session: { ...s.session, onboardingCompleted: true } })),
      setPhone: (phone) => set((s) => ({ session: { ...s.session, phone } })),
      verifyOtp: () => set((s) => ({ session: { ...s.session, otpVerified: true, isAuthenticated: true } })),
      setSupabaseAuth: (userId, provider) =>
        set((s) => ({ session: { ...s.session, supabaseUserId: userId, authProvider: provider, isAuthenticated: true } })),
      createProfile: ({ firstName, lastName, namePrivacy, bio, avatarUrl }) =>
        set((s) => ({
          session: { ...s.session, profileCreated: true },
          users: s.users.map((u) => (u.id === CURRENT_USER_ID ? { ...u, firstName, lastName, namePrivacy, bio, avatarUrl } : u)),
        })),
      selectCity: ({ regionId, cityId }) =>
        set((s) => ({ session: { ...s.session, regionId, cityId, neighborhoodId: null } })),
      addRecentCity: (cityId) =>
        set((s) => ({ recentCityIds: [cityId, ...s.recentCityIds.filter((id) => id !== cityId)].slice(0, 5) })),
      recordReferralInviteSent: () =>
        set((s) => ({ referral: { ...s.referral, invitesSent: s.referral.invitesSent + 1 } })),
      selectNeighborhood: (neighborhoodId) =>
        set((s) => ({
          session: { ...s.session, neighborhoodId },
          users: s.users.map((u) => (u.id === CURRENT_USER_ID ? { ...u, neighborhoodId } : u)),
        })),
      submitNeighborhoodSuggestion: (input) => {
        const suggestion: NeighborhoodSuggestion = {
          ...input,
          id: uid('nsug'),
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        set((s) => ({ neighborhoodSuggestions: [suggestion, ...s.neighborhoodSuggestions] }));
        return suggestion;
      },
      setVerification: (status) => set((s) => ({ session: { ...s.session, verification: status } })),

      signOut: () => set({ session: initialSession }),
      resetDemoData: () => set({ settings: initialSettings, session: initialSession, ...freshEntities() }),

      currentUser: () => {
        const u = get().users.find((x) => x.id === CURRENT_USER_ID);
        if (!u) throw new Error('current user missing');
        return u;
      },
      getUser: (id) => get().users.find((u) => u.id === id),

      createPost: ({ type, textAr, images, audience }) => {
        const s = get();
        const post: Post = {
          id: uid('p'),
          type,
          authorId: CURRENT_USER_ID,
          neighborhoodId: s.session.neighborhoodId ?? s.currentUser().neighborhoodId,
          textAr,
          images,
          createdAt: new Date().toISOString(),
          reactions: [],
          commentCount: 0,
          savedBy: [],
          audience,
        };
        set((st) => ({ posts: [post, ...st.posts] }));
        return post;
      },
      toggleReaction: (postId, type) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const exists = p.reactions.find((r) => r.userId === CURRENT_USER_ID);
            if (exists) {
              return { ...p, reactions: p.reactions.filter((r) => r.userId !== CURRENT_USER_ID) };
            }
            return { ...p, reactions: [...p.reactions, { userId: CURRENT_USER_ID, type }] };
          }),
        })),
      toggleSavePost: (postId) =>
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            const saved = p.savedBy.includes(CURRENT_USER_ID);
            return { ...p, savedBy: saved ? p.savedBy.filter((id) => id !== CURRENT_USER_ID) : [...p.savedBy, CURRENT_USER_ID] };
          }),
        })),
      addComment: (postId, textAr, parentId) => {
        const comment: Comment = {
          id: uid('cm'),
          postId,
          authorId: CURRENT_USER_ID,
          parentId,
          textAr,
          createdAt: new Date().toISOString(),
          likedBy: [],
        };
        set((s) => ({
          comments: [...s.comments, comment],
          posts: s.posts.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
        }));
        return comment;
      },
      editComment: (commentId, textAr) =>
        set((s) => ({ comments: s.comments.map((c) => (c.id === commentId ? { ...c, textAr, edited: true } : c)) })),
      deleteComment: (commentId) =>
        set((s) => {
          const c = s.comments.find((x) => x.id === commentId);
          return {
            comments: s.comments.filter((x) => x.id !== commentId),
            posts: c ? s.posts.map((p) => (p.id === c.postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p)) : s.posts,
          };
        }),
      toggleCommentLike: (commentId) =>
        set((s) => ({
          comments: s.comments.map((c) => {
            if (c.id !== commentId) return c;
            const liked = c.likedBy.includes(CURRENT_USER_ID);
            return { ...c, likedBy: liked ? c.likedBy.filter((id) => id !== CURRENT_USER_ID) : [...c.likedBy, CURRENT_USER_ID] };
          }),
        })),
      deletePost: (postId) => set((s) => ({ posts: s.posts.filter((p) => p.id !== postId) })),

      createIssue: (input) => {
        const issue: Issue = {
          ...input,
          id: uid('i'),
          reporterId: CURRENT_USER_ID,
          status: 'reported',
          affectedUserIds: [CURRENT_USER_ID],
          followerIds: [CURRENT_USER_ID],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          issues: [issue, ...s.issues],
          issueUpdates: [...s.issueUpdates, { id: uid('iu'), issueId: issue.id, status: 'reported', createdAt: issue.createdAt }],
        }));
        return issue;
      },
      markIssueAffected: (issueId) =>
        set((s) => ({
          issues: s.issues.map((i) => {
            if (i.id !== issueId) return i;
            if (i.affectedUserIds.includes(CURRENT_USER_ID)) return i;
            return { ...i, affectedUserIds: [...i.affectedUserIds, CURRENT_USER_ID] };
          }),
        })),
      toggleFollowIssue: (issueId) =>
        set((s) => ({
          issues: s.issues.map((i) => {
            if (i.id !== issueId) return i;
            const following = i.followerIds.includes(CURRENT_USER_ID);
            return {
              ...i,
              followerIds: following ? i.followerIds.filter((id) => id !== CURRENT_USER_ID) : [...i.followerIds, CURRENT_USER_ID],
            };
          }),
        })),
      setIssueStatus: (issueId, status, note) =>
        set((s) => ({
          issues: s.issues.map((i) => (i.id === issueId ? { ...i, status } : i)),
          issueUpdates: [...s.issueUpdates, { id: uid('iu'), issueId, status, note, createdAt: new Date().toISOString() }],
        })),

      createHelpRequest: (input) => {
        const req: HelpRequest = {
          ...input,
          id: uid('h'),
          requesterId: CURRENT_USER_ID,
          createdAt: new Date().toISOString(),
          offeredBy: [],
          status: 'open',
        };
        set((s) => ({ helpRequests: [req, ...s.helpRequests] }));
        return req;
      },
      offerHelp: (helpRequestId) =>
        set((s) => ({
          helpRequests: s.helpRequests.map((h) => {
            if (h.id !== helpRequestId) return h;
            if (h.offeredBy.includes(CURRENT_USER_ID)) return h;
            return { ...h, offeredBy: [...h.offeredBy, CURRENT_USER_ID], status: 'in_progress' };
          }),
        })),
      resolveHelpRequest: (helpRequestId) =>
        set((s) => ({ helpRequests: s.helpRequests.map((h) => (h.id === helpRequestId ? { ...h, status: 'resolved' } : h)) })),

      createEvent: (input) => {
        const event: CommunityEvent = {
          ...input,
          id: uid('e'),
          hostId: CURRENT_USER_ID,
          attendees: [{ userId: CURRENT_USER_ID, status: 'going', joinedAt: new Date().toISOString() }],
        };
        set((s) => ({ events: [event, ...s.events] }));
        return event;
      },
      joinEvent: (eventId) =>
        set((s) => ({
          events: s.events.map((e) => {
            if (e.id !== eventId) return e;
            const going = e.attendees.filter((a) => a.status === 'going').length;
            const already = e.attendees.find((a) => a.userId === CURRENT_USER_ID);
            if (already) return e;
            const status = going < e.capacity ? 'going' : 'waitlisted';
            return { ...e, attendees: [...e.attendees, { userId: CURRENT_USER_ID, status, joinedAt: new Date().toISOString() }] };
          }),
        })),
      leaveEvent: (eventId) =>
        set((s) => ({
          events: s.events.map((e) => {
            if (e.id !== eventId) return e;
            const remaining = e.attendees.filter((a) => a.userId !== CURRENT_USER_ID);
            // promote first waitlisted to going
            const goingCount = remaining.filter((a) => a.status === 'going').length;
            if (goingCount < e.capacity) {
              const firstWaitlisted = remaining.find((a) => a.status === 'waitlisted');
              if (firstWaitlisted) firstWaitlisted.status = 'going';
            }
            return { ...e, attendees: remaining };
          }),
        })),
      cancelEvent: (eventId) => set((s) => ({ events: s.events.map((e) => (e.id === eventId ? { ...e, cancelled: true } : e)) })),

      voteInPoll: (pollId, optionId) =>
        set((s) => ({
          polls: s.polls.map((p) => {
            if (p.id !== pollId) return p;
            const alreadyVoted = p.options.some((o) => o.votes.includes(CURRENT_USER_ID));
            if (alreadyVoted) return p;
            return { ...p, options: p.options.map((o) => (o.id === optionId ? { ...o, votes: [...o.votes, CURRENT_USER_ID] } : o)) };
          }),
        })),

      createPoll: ({ question, options, closesInHours }) => {
        const s = get();
        const neighborhoodId = s.session.neighborhoodId ?? s.currentUser().neighborhoodId;
        const poll: Poll = {
          id: uid('poll'),
          postId: '',
          question,
          options: options.map((textAr) => ({ id: uid('o'), textAr, votes: [] })),
          closesAt: new Date(Date.now() + closesInHours * 3600 * 1000).toISOString(),
          neighborhoodId,
        };
        const post: Post = {
          id: uid('p'),
          type: 'poll',
          authorId: CURRENT_USER_ID,
          neighborhoodId,
          textAr: question,
          images: [],
          createdAt: new Date().toISOString(),
          reactions: [],
          commentCount: 0,
          savedBy: [],
          linkedEntityId: poll.id,
          audience: 'neighborhood',
        };
        poll.postId = post.id;
        set((st) => ({ polls: [poll, ...st.polls], posts: [post, ...st.posts] }));
        return poll;
      },

      createListing: (input) => {
        const listing: MarketplaceListing = {
          ...input,
          id: uid('m'),
          sellerId: CURRENT_USER_ID,
          createdAt: new Date().toISOString(),
          savedBy: [],
          status: 'available',
        };
        set((s) => ({ marketplaceListings: [listing, ...s.marketplaceListings] }));
        return listing;
      },
      toggleSaveListing: (listingId) =>
        set((s) => ({
          marketplaceListings: s.marketplaceListings.map((m) => {
            if (m.id !== listingId) return m;
            const saved = m.savedBy.includes(CURRENT_USER_ID);
            return { ...m, savedBy: saved ? m.savedBy.filter((id) => id !== CURRENT_USER_ID) : [...m.savedBy, CURRENT_USER_ID] };
          }),
        })),

      requestBorrow: (itemId) =>
        set((s) => ({
          borrowItems: s.borrowItems.map((b) => {
            if (b.id !== itemId) return b;
            if (b.requests.some((r) => r.userId === CURRENT_USER_ID)) return b;
            return { ...b, requests: [...b.requests, { userId: CURRENT_USER_ID, status: 'pending', createdAt: new Date().toISOString() }] };
          }),
        })),

      recommendBusiness: (businessId, textAr) =>
        set((s) => ({
          recommendations: [
            { id: uid('r'), businessId, authorId: CURRENT_USER_ID, textAr, createdAt: new Date().toISOString(), sentiment: 'positive' },
            ...s.recommendations,
          ],
          businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, recommendationCount: b.recommendationCount + 1 } : b)),
        })),

      createLostFound: (input) => {
        const post: LostFoundPost = {
          ...input,
          id: uid('lf'),
          authorId: CURRENT_USER_ID,
          createdAt: new Date().toISOString(),
          status: input.status ?? 'lost',
        };
        set((s) => ({ lostFound: [post, ...s.lostFound] }));
        return post;
      },
      markLostFoundStatus: (id, status) => set((s) => ({ lostFound: s.lostFound.map((l) => (l.id === id ? { ...l, status } : l)) })),

      sendMessage: (conversationId, text, image) => {
        const message: Message = {
          id: uid('msg'),
          conversationId,
          senderId: CURRENT_USER_ID,
          text,
          image,
          createdAt: new Date().toISOString(),
          readBy: [CURRENT_USER_ID],
        };
        set((s) => ({
          messages: [...s.messages, message],
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, lastMessageAt: message.createdAt } : c)),
        }));
        return message;
      },
      simulateIncomingMessage: (conversationId, senderId, text) => {
        const message: Message = {
          id: uid('msg'),
          conversationId,
          senderId,
          text,
          createdAt: new Date().toISOString(),
          readBy: [senderId],
        };
        set((s) => ({
          messages: [...s.messages, message],
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, lastMessageAt: message.createdAt } : c)),
        }));
        return message;
      },
      getOrCreateConversation: (otherUserId) => {
        const s = get();
        const existing = s.conversations.find(
          (c) => !c.isGroup && c.participantIds.includes(otherUserId) && c.participantIds.includes(CURRENT_USER_ID),
        );
        if (existing) return existing;
        const convo: Conversation = {
          id: uid('conv'),
          participantIds: [CURRENT_USER_ID, otherUserId],
          lastMessageAt: new Date().toISOString(),
        };
        set((st) => ({ conversations: [convo, ...st.conversations] }));
        return convo;
      },
      markConversationRead: (conversationId) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.conversationId === conversationId && !m.readBy.includes(CURRENT_USER_ID)
              ? { ...m, readBy: [...m.readBy, CURRENT_USER_ID] }
              : m,
          ),
        })),

      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      thankUser: (userId, reasonAr, message) =>
        set((s) => ({
          reputationEvents: [
            {
              id: uid('re'),
              userId,
              type: 'thanks',
              reasonAr: message ? `${reasonAr} — ${message}` : reasonAr,
              fromUserId: CURRENT_USER_ID,
              createdAt: new Date().toISOString(),
            },
            ...s.reputationEvents,
          ],
          users: s.users.map((u) => (u.id === userId ? { ...u, stats: { ...u.stats, thanksReceived: u.stats.thanksReceived + 1 } } : u)),
        })),

      toggleBlockUser: (userId) =>
        set((s) => ({
          blockedUserIds: s.blockedUserIds.includes(userId)
            ? s.blockedUserIds.filter((id) => id !== userId)
            : [...s.blockedUserIds, userId],
        })),
      toggleMuteUser: (userId) =>
        set((s) => ({
          mutedUserIds: s.mutedUserIds.includes(userId) ? s.mutedUserIds.filter((id) => id !== userId) : [...s.mutedUserIds, userId],
        })),
      submitReport: (targetType, targetId, reasonType, note) =>
        set((s) => ({
          reports: [
            { id: uid('rep'), targetType, targetId, reasonType, note, createdAt: new Date().toISOString(), status: 'open' },
            ...s.reports,
          ],
        })),
      moderateReport: (reportId, status) => set((s) => ({ reports: s.reports.map((r) => (r.id === reportId ? { ...r, status } : r)) })),
      removeContent: (targetType, targetId) =>
        set((s) => {
          if (targetType === 'post') return { posts: s.posts.filter((p) => p.id !== targetId) };
          if (targetType === 'comment') return { comments: s.comments.filter((c) => c.id !== targetId) };
          if (targetType === 'listing') return { marketplaceListings: s.marketplaceListings.filter((m) => m.id !== targetId) };
          return {};
        }),

      toggleAlertFollow: (alertId) =>
        set((s) => ({
          alerts: s.alerts.map((a) => {
            if (a.id !== alertId) return a;
            const following = a.followerIds.includes(CURRENT_USER_ID);
            return {
              ...a,
              followerIds: following ? a.followerIds.filter((id) => id !== CURRENT_USER_ID) : [...a.followerIds, CURRENT_USER_ID],
            };
          }),
        })),
      toggleAlertHelpful: (alertId) =>
        set((s) => ({
          alerts: s.alerts.map((a) => {
            if (a.id !== alertId) return a;
            const helpful = a.helpfulBy.includes(CURRENT_USER_ID);
            return { ...a, helpfulBy: helpful ? a.helpfulBy.filter((id) => id !== CURRENT_USER_ID) : [...a.helpfulBy, CURRENT_USER_ID] };
          }),
        })),

      addSearchHistory: (query) => set((s) => ({ searchHistory: [query, ...s.searchHistory.filter((q) => q !== query)].slice(0, 10) })),
      clearSearchHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: 'haratna-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      merge: mergePersistedState,
      // No breaking change to the persisted shape yet — this is
      // scaffolding so a future one has a real place to land a real
      // transform, instead of the zustand default of logging "couldn't
      // be migrated" and silently discarding the entire persisted state
      // (session, settings, referral stats, everything) the next time
      // `version` is bumped.
      migrate: (persistedState) => persistedState,
    },
  ),
);

export const listingTypeLabel = (t: ListingType) => t;
export { CURRENT_USER_ID };
