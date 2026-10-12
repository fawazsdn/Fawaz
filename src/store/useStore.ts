import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  AlertItem,
  AppNotification,
  Business,
  BorrowItem,
  Comment,
  CommunityEvent,
  CommunityGroup,
  Conversation,
  HelpRequest,
  Institution,
  Issue,
  IssueUpdate,
  Locale,
  LostFoundPost,
  MarketplaceListing,
  Message,
  Neighborhood,
  Poll,
  Post,
  Recommendation,
  ReferralStats,
  ReportReason,
  ReportTargetType,
  ReputationEvent,
  ThemeMode,
  User,
  VerificationStatus,
} from '@/models';

/**
 * Global app state.
 *
 * Every entity array below starts EMPTY and is only ever filled from real
 * Supabase rows by src/backend/sync.ts — there is no seed/demo data in the
 * app bundle. Mutations go through src/backend/actions.ts (which writes to
 * Supabase under RLS and then re-syncs); components never fabricate records.
 *
 * Only user preferences and lightweight session pointers are persisted to
 * AsyncStorage; neighborhood content is always re-fetched from the server.
 */

interface Settings {
  locale: Locale;
  themeMode: ThemeMode;
  ramadanMode: boolean;
  notificationsEnabled: boolean;
  whoCanMessage: 'everyone' | 'neighbors' | 'nobody';
  activityVisible: boolean;
}

export type AuthProvider = 'email' | 'apple' | 'google';

interface SessionState {
  onboardingCompleted: boolean;
  profileCreated: boolean;
  /** Real sa-region-* / sa-city-* ids from the Saudi geography dataset. */
  regionId: string | null;
  cityId: string | null;
  neighborhoodId: string | null;
  verification: VerificationStatus;
  isAuthenticated: boolean;
  /** The real Supabase auth.uid() — never a client-invented id. */
  supabaseUserId: string | null;
  authProvider: AuthProvider | null;
  email: string | null;
}

export type SyncStatus = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

export interface ReportRecord {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonType: ReportReason;
  note?: string;
  createdAt: string;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
}

export interface EntityState {
  neighborhoods: Neighborhood[];
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
  reports: ReportRecord[];
}

interface AppState extends EntityState {
  settings: Settings;
  session: SessionState;
  sync: { status: SyncStatus; lastSyncedAt: string | null; error: string | null };

  searchHistory: string[];
  /** Recently-selected city ids (most recent first), for onboarding shortcuts. */
  recentCityIds: string[];
  referral: ReferralStats;

  // -- preferences --
  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setRamadanMode: (on: boolean) => void;
  setSettings: (partial: Partial<Settings>) => void;

  // -- session (pointers only; truth lives in Supabase) --
  completeOnboarding: () => void;
  setSupabaseAuth: (userId: string, provider: AuthProvider, email?: string | null) => void;
  markProfileCreated: () => void;
  selectCity: (params: { regionId: string; cityId: string }) => void;
  addRecentCity: (cityId: string) => void;
  recordReferralInviteSent: () => void;
  setNeighborhoodPointer: (neighborhoodId: string | null) => void;
  setVerification: (status: VerificationStatus) => void;
  patchSession: (partial: Partial<SessionState>) => void;
  signOut: () => void;

  // -- sync (written only by src/backend/sync.ts) --
  setSync: (partial: Partial<AppState['sync']>) => void;
  applyEntities: (partial: Partial<EntityState>) => void;
  setReferral: (partial: Partial<ReferralStats>) => void;

  // -- selectors --
  currentUser: () => User | undefined;
  getUser: (id: string) => User | undefined;

  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
}

const initialSettings: Settings = {
  locale: 'ar',
  themeMode: 'system',
  ramadanMode: false,
  notificationsEnabled: true,
  whoCanMessage: 'neighbors',
  activityVisible: true,
};

const initialSession: SessionState = {
  onboardingCompleted: false,
  profileCreated: false,
  regionId: null,
  cityId: null,
  neighborhoodId: null,
  verification: 'not_started',
  isAuthenticated: false,
  supabaseUserId: null,
  authProvider: null,
  email: null,
};

export function emptyEntities(): EntityState {
  return {
    neighborhoods: [],
    users: [],
    posts: [],
    comments: [],
    issues: [],
    issueUpdates: [],
    helpRequests: [],
    events: [],
    polls: [],
    marketplaceListings: [],
    borrowItems: [],
    businesses: [],
    recommendations: [],
    lostFound: [],
    conversations: [],
    messages: [],
    notifications: [],
    institutions: [],
    alerts: [],
    communityGroups: [],
    reputationEvents: [],
    blockedUserIds: [],
    mutedUserIds: [],
    reports: [],
  };
}

/** The signed-in resident's real auth.uid(), or '' when signed out. */
export function getCurrentUserId(): string {
  return useStore.getState().session.supabaseUserId ?? '';
}

/** Hook form of getCurrentUserId — re-renders on sign-in/out. */
export function useCurrentUserId(): string {
  return useStore((s) => s.session.supabaseUserId ?? '');
}

type PersistedShape = Pick<AppState, 'settings' | 'session' | 'searchHistory' | 'recentCityIds'> & { referral?: ReferralStats };

/**
 * The persist middleware's `merge`, exported for unit tests. Only
 * settings/session/history are persisted; anything else in an older
 * persisted blob (e.g. the seeded demo entities shipped by earlier builds)
 * is ignored so it can never resurface as "real" content. Session/settings
 * are deep-merged so new fields get their defaults; obsolete phone/OTP and
 * demo-role fields from older builds are dropped.
 */
export function mergePersistedState(persistedState: unknown, currentState: AppState): AppState {
  const persisted = (persistedState ?? {}) as Partial<PersistedShape>;
  const merged: AppState = { ...currentState };
  if (persisted.settings) {
    const { locale, themeMode, ramadanMode, notificationsEnabled, whoCanMessage, activityVisible } = { ...currentState.settings, ...persisted.settings };
    merged.settings = { locale, themeMode, ramadanMode, notificationsEnabled, whoCanMessage, activityVisible };
  }
  if (persisted.session) {
    const s = { ...currentState.session, ...persisted.session } as SessionState & { authProvider: string | null };
    merged.session = {
      onboardingCompleted: s.onboardingCompleted,
      profileCreated: s.profileCreated,
      regionId: s.regionId,
      cityId: s.cityId,
      neighborhoodId: s.neighborhoodId,
      verification: s.verification,
      // A session is only "authenticated" with a real Supabase user id. Older
      // builds marked phone/OTP demo logins authenticated without one.
      isAuthenticated: !!s.supabaseUserId && s.isAuthenticated,
      supabaseUserId: s.supabaseUserId ?? null,
      authProvider: s.authProvider === 'email' || s.authProvider === 'apple' || s.authProvider === 'google' ? s.authProvider : null,
      email: s.email ?? null,
    };
  }
  if (Array.isArray(persisted.searchHistory)) merged.searchHistory = persisted.searchHistory;
  if (Array.isArray(persisted.recentCityIds)) merged.recentCityIds = persisted.recentCityIds;
  if (persisted.referral && typeof persisted.referral.invitesSent === 'number') {
    merged.referral = { ...currentState.referral, invitesSent: persisted.referral.invitesSent };
  }
  return merged;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      session: initialSession,
      sync: { status: 'idle', lastSyncedAt: null, error: null },
      ...emptyEntities(),
      searchHistory: [],
      recentCityIds: [],
      referral: { invitesSent: 0, joinedCount: null },

      setLocale: (locale) => set((s) => ({ settings: { ...s.settings, locale } })),
      setThemeMode: (mode) => set((s) => ({ settings: { ...s.settings, themeMode: mode } })),
      setRamadanMode: (on) => set((s) => ({ settings: { ...s.settings, ramadanMode: on } })),
      setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),

      completeOnboarding: () => set((s) => ({ session: { ...s.session, onboardingCompleted: true } })),
      setSupabaseAuth: (userId, provider, email) =>
        set((s) => {
          const switchedUser = s.session.supabaseUserId && s.session.supabaseUserId !== userId;
          return {
            ...(switchedUser ? emptyEntities() : {}),
            session: {
              ...(switchedUser ? initialSession : s.session),
              onboardingCompleted: true,
              supabaseUserId: userId,
              authProvider: provider,
              email: email ?? s.session.email,
              isAuthenticated: true,
            },
          };
        }),
      markProfileCreated: () => set((s) => ({ session: { ...s.session, profileCreated: true } })),
      selectCity: ({ regionId, cityId }) => set((s) => ({ session: { ...s.session, regionId, cityId } })),
      addRecentCity: (cityId) => set((s) => ({ recentCityIds: [cityId, ...s.recentCityIds.filter((id) => id !== cityId)].slice(0, 5) })),
      recordReferralInviteSent: () => set((s) => ({ referral: { ...s.referral, invitesSent: s.referral.invitesSent + 1 } })),
      setNeighborhoodPointer: (neighborhoodId) => set((s) => ({ session: { ...s.session, neighborhoodId } })),
      setVerification: (status) => set((s) => ({ session: { ...s.session, verification: status } })),
      patchSession: (partial) => set((s) => ({ session: { ...s.session, ...partial } })),

      signOut: () =>
        set((s) => ({
          ...emptyEntities(),
          session: { ...initialSession, onboardingCompleted: s.session.onboardingCompleted },
          sync: { status: 'idle', lastSyncedAt: null, error: null },
          referral: { invitesSent: 0, joinedCount: null },
        })),

      setSync: (partial) => set((s) => ({ sync: { ...s.sync, ...partial } })),
      applyEntities: (partial) => set(partial),
      setReferral: (partial) => set((s) => ({ referral: { ...s.referral, ...partial } })),

      currentUser: () => {
        const id = get().session.supabaseUserId;
        return id ? get().users.find((u) => u.id === id) : undefined;
      },
      getUser: (id) => get().users.find((u) => u.id === id),

      addSearchHistory: (query) => set((s) => ({ searchHistory: [query, ...s.searchHistory.filter((q) => q !== query)].slice(0, 10) })),
      clearSearchHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: 'haratna-store',
      storage: createJSONStorage(() => AsyncStorage),
      // v2: entities are no longer persisted (they were seeded demo data in v1).
      version: 2,
      partialize: (s) => ({
        settings: s.settings,
        session: s.session,
        searchHistory: s.searchHistory,
        recentCityIds: s.recentCityIds,
        referral: s.referral,
      }),
      merge: mergePersistedState,
      migrate: (persistedState) => persistedState,
    },
  ),
);
