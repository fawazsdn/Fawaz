// Core frontend data models for Haratna.
// Every instance is mapped from a real Supabase row (see src/backend/mappers.ts);
// nothing here is seeded or invented on the client.

export type Locale = 'ar' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';

/** profiles.app_role — set server-side only (protected by the profiles_protect_privileges trigger). */
export type AppRole = 'resident' | 'moderator' | 'organizer' | 'business' | 'admin';

export type NamePrivacy = 'full' | 'first_last_initial' | 'first_only';

/**
 * A neighborhood from the official Saudi geography dataset (address.gov.sa),
 * plus aggregate counts from the `neighborhood_stats` RPC. Counts are
 * `null` until loaded — never a placeholder number.
 */
export interface Neighborhood {
  id: string;
  cityId: string;
  regionId: string;
  nameAr: string;
  nameEn: string;
  residentsCount: number | null;
  eventsThisWeek: number | null;
  openIssues: number | null;
  helpfulActions: number | null;
  centerLat: number;
  centerLng: number;
  /** True when an authoritative boundary polygon exists (location verification possible). */
  hasBoundary: boolean;
}

export type VerificationStatus = 'not_started' | 'checking' | 'pending' | 'verified' | 'failed';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  namePrivacy: NamePrivacy;
  neighborhoodId: string;
  verification: VerificationStatus;
  role: AppRole;
  memberSince: string; // ISO date
  reputationPoints: number;
  reputationTier: ReputationTier;
  stats: {
    neighborsHelped: number;
    eventsHosted: number;
    thanksReceived: number;
  };
  isSelf?: boolean;
}

export type ReputationTier = 'new_neighbor' | 'neighbor' | 'contributor' | 'community_builder' | 'community_champion';

export interface ReputationEvent {
  id: string;
  userId: string;
  type: 'thanks' | 'helped' | 'hosted_event' | 'resolved_issue';
  reasonAr: string;
  fromUserId?: string;
  createdAt: string;
}

export type PostType =
  'general' | 'announcement' | 'issue' | 'help' | 'event' | 'poll' | 'recommendation' | 'lost_found' | 'marketplace' | 'alert';

export interface Reaction {
  userId: string;
  type: 'like' | 'helpful';
}

export interface Post {
  id: string;
  type: PostType;
  authorId: string;
  neighborhoodId: string;
  textAr: string;
  textEn?: string;
  images: string[];
  createdAt: string;
  reactions: Reaction[];
  commentCount: number;
  savedBy: string[];
  linkedEntityId?: string; // event/issue/poll/marketplace id when relevant
  audience: 'neighborhood' | 'city';
  pinned?: boolean;
  /** Opt-in, approximate geotag shown on the map. */
  approxLat?: number;
  approxLng?: number;
  locationLabel?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId?: string;
  textAr: string;
  createdAt: string;
  likedBy: string[];
  edited?: boolean;
}

export type IssueCategory =
  'streetlight' | 'road_damage' | 'trash' | 'water' | 'electricity' | 'flooding' | 'abandoned_vehicle' | 'safety' | 'other';

export type IssueStatus = 'reported' | 'confirmed' | 'submitted' | 'under_review' | 'in_progress' | 'resolved';

export interface IssueUpdate {
  id: string;
  issueId: string;
  status: IssueStatus;
  note?: string;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  category: IssueCategory;
  description: string;
  images: string[];
  neighborhoodId: string;
  reporterId: string;
  status: IssueStatus;
  affectedUserIds: string[];
  followerIds: string[];
  createdAt: string;
  approxLat?: number;
  approxLng?: number;
}

export type HelpCategory = 'car' | 'borrow_item' | 'moving' | 'lost_pet' | 'home' | 'other';

export interface HelpRequest {
  id: string;
  title: string;
  category: HelpCategory;
  description: string;
  requesterId: string;
  neighborhoodId: string;
  createdAt: string;
  approxDistanceM: number;
  offeredBy: string[];
  status: 'open' | 'in_progress' | 'resolved';
}

export type EventCategory =
  | 'football'
  | 'padel'
  | 'basketball'
  | 'volleyball'
  | 'running'
  | 'walking'
  | 'cycling'
  | 'fitness'
  | 'hiking'
  | 'swimming'
  | 'tournaments'
  | 'coffee'
  | 'family'
  | 'kids'
  | 'community'
  | 'food'
  | 'networking'
  | 'gaming'
  | 'movies'
  | 'arts'
  | 'entertainment'
  | 'celebrations'
  | 'cleanup'
  | 'volunteering'
  | 'education'
  | 'markets'
  | 'religious'
  | 'outdoors'
  | 'pets'
  | 'iftar'
  | 'other';

export type Recurrence = 'none' | 'weekly' | 'biweekly' | 'monthly';

/** Activities are casual/recurring gatherings; events are one-off occasions. Same backend table. */
export type EventKind = 'event' | 'activity';

/** Saudi occasions an event/activity can be tagged with (e.g. a Ramadan football tournament). */
export type EventOccasion = 'national_day' | 'founding_day' | 'ramadan' | 'eid' | 'festival';

export type AttendeeStatus = 'not_joined' | 'going' | 'waitlisted' | 'interested' | 'cancelled';

export interface EventAttendee {
  userId: string;
  status: AttendeeStatus;
  joinedAt: string;
}

export interface CommunityEvent {
  id: string;
  kind: EventKind;
  occasion?: EventOccasion;
  title: string;
  category: EventCategory;
  /** Resident-typed label when category is 'other' (trimmed, ≤ 40 chars). */
  customCategory?: string;
  /** Club that organizes this activity (club activities live in the same events table). */
  clubId?: string;
  /** Occurrences of one recurring schedule share a seriesId. */
  seriesId?: string;
  recurrence: Recurrence;
  /** Only active club members can RSVP (enforced server-side). */
  membersOnly: boolean;
  /** Signed URL of the organizer's uploaded cover, if any — never a stock placeholder. */
  coverImage?: string;
  description: string;
  hostId: string;
  neighborhoodId: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string;
  approxLat?: number;
  approxLng?: number;
  capacity: number;
  audience: 'neighborhood' | 'city';
  recurring: boolean;
  attendees: EventAttendee[];
  rules?: string;
  cancelled?: boolean;
}

export interface PollOption {
  id: string;
  textAr: string;
  /** Aggregate count from get_poll_results — individual voters are private. */
  votes: number;
}

export interface Poll {
  id: string;
  postId: string;
  question: string;
  options: PollOption[];
  closesAt: string;
  neighborhoodId: string;
  totalVotes: number;
  /** The signed-in resident's current choice, if they voted. */
  myOptionId?: string;
  allowChange: boolean;
}

export type ListingType = 'sale' | 'free' | 'wanted';
export type ListingCondition = 'new' | 'like_new' | 'good' | 'used' | 'for_parts';

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  listingType: ListingType;
  price?: number; // SAR, undefined for free/wanted
  condition: ListingCondition;
  sellerId: string;
  neighborhoodId: string;
  approxDistanceM: number;
  createdAt: string;
  savedBy: string[];
  status: 'available' | 'reserved' | 'sold';
}

export interface BorrowItem {
  id: string;
  title: string;
  category: string;
  image?: string;
  ownerId: string;
  neighborhoodId: string;
  available: boolean;
  description: string;
  requests: { userId: string; status: 'pending' | 'accepted' | 'declined'; createdAt: string }[];
}

export type ServiceCategory =
  | 'electrician'
  | 'plumber'
  | 'ac_repair'
  | 'car_wash'
  | 'cleaning'
  | 'restaurant'
  | 'cafe'
  | 'barber'
  | 'tailor'
  | 'tutor'
  | 'pet_services';

export interface Business {
  id: string;
  name: string;
  category: ServiceCategory;
  coverImage?: string;
  logo?: string;
  description: string;
  neighborhoodIds: string[];
  hours: string;
  phoneMasked: string;
  communityVerified: boolean;
  recommendationCount: number;
  approxLat?: number;
  approxLng?: number;
  locationLabel?: string;
}

export interface Recommendation {
  id: string;
  businessId: string;
  authorId: string;
  textAr: string;
  createdAt: string;
  sentiment: 'positive' | 'neutral';
}

export type LostFoundStatus = 'lost' | 'found' | 'reunited';

export interface LostFoundPost {
  id: string;
  kind: 'pet' | 'item';
  title: string;
  description: string;
  image?: string;
  status: LostFoundStatus;
  neighborhoodId: string;
  authorId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  kind: 'direct' | 'neighborhood' | 'group' | 'event';
  participantIds: string[];
  eventId?: string;
  /** Set for club chats (kind 'group'). */
  groupId?: string;
  isGroup?: boolean;
  title?: string;
  lastMessageAt: string;
  /** When the signed-in resident last read this conversation. */
  lastReadAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  image?: string;
  replyToId?: string;
  createdAt: string;
  readBy: string[];
}

export type NotificationType =
  | 'reply'
  | 'thanks'
  | 'event_reminder'
  | 'issue_update'
  | 'help_response'
  | 'message'
  | 'alert'
  | 'marketplace_inquiry'
  | 'group_activity'
  | 'referral'
  | 'moderation';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  titleAr: string;
  titleEn?: string;
  bodyAr: string;
  bodyEn?: string;
  createdAt: string;
  read: boolean;
  deepLink: string; // e.g. /post/123
  actorId?: string;
}

export type InstitutionType = 'mosque' | 'school' | 'sports_club' | 'community_center';

export interface Institution {
  id: string;
  type: InstitutionType;
  name: string;
  neighborhoodId: string;
  coverImage?: string;
  verified: boolean;
  announcements: { id: string; textAr: string; createdAt: string }[];
  classes: { id: string; titleAr: string; schedule: string }[];
  volunteerOpportunities: { id: string; titleAr: string; spotsLeft: number }[];
}

export type ReportReason =
  'spam' | 'scam' | 'harassment' | 'privacy_violation' | 'inappropriate' | 'misinformation' | 'impersonation' | 'other';

export type ReportTargetType = 'post' | 'comment' | 'user' | 'listing' | 'message' | 'event' | 'group' | 'business';

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reasonType: ReportReason;
  note?: string;
  reporterId: string;
  createdAt: string;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
}

// ------------------------------------------------------------------ clubs --

/** Stable club category ids (community_groups.category check constraint). Labels live in i18n. */
export type ClubCategory =
  | 'running'
  | 'cycling'
  | 'football'
  | 'padel'
  | 'basketball'
  | 'volleyball'
  | 'fitness'
  | 'walking'
  | 'hiking'
  | 'swimming'
  | 'coffee'
  | 'community'
  | 'family'
  | 'networking'
  | 'food'
  | 'travel'
  | 'photography'
  | 'gaming'
  | 'books'
  | 'chess'
  | 'art'
  | 'music'
  | 'technology'
  | 'cars'
  | 'volunteering'
  | 'environment'
  | 'education'
  | 'workshops'
  | 'neighborhood_improvement'
  | 'other';

export type ClubReviewStatus = 'draft' | 'pending_review' | 'needs_changes' | 'approved' | 'rejected' | 'suspended' | 'archived';
export type ClubMembershipType = 'open' | 'approval';
export type ClubRole = 'owner' | 'moderator' | 'member';
export type ClubMemberStatus = 'pending' | 'active' | 'banned' | 'left' | 'removed' | 'rejected';

/** A neighborhood club (community_groups). Only approved clubs are visible to neighbors. */
export interface Club {
  id: string;
  name: string;
  description: string;
  category: ClubCategory;
  customCategory?: string;
  neighborhoodId: string;
  ownerId: string;
  coverImage?: string;
  logo?: string;
  /** Storage paths, needed to keep images unchanged when editing. */
  coverImagePath?: string;
  logoPath?: string;
  membershipType: ClubMembershipType;
  rules: string;
  meetingSchedule?: string;
  purpose: string;
  plannedActivities: string;
  meetingFrequency: string;
  neighborhoodBenefit: string;
  meetingLocation?: string;
  additionalInfo?: string;
  reviewStatus: ClubReviewStatus;
  reviewNote?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  /** Active members, from club_member_counts (real count, never estimated). */
  memberCount: number;
}

export interface ClubMembership {
  clubId: string;
  userId: string;
  role: ClubRole;
  status: ClubMemberStatus;
  joinedAt: string;
}

export interface ClubAnnouncement {
  id: string;
  clubId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export type ClubDecision =
  'approved' | 'rejected' | 'needs_changes' | 'suspended' | 'revoked' | 'reinstated' | 'submitted' | 'resubmitted' | 'archived';

export interface ClubReviewDecision {
  id: string;
  clubId: string;
  adminId?: string;
  decision: ClubDecision;
  reason?: string;
  createdAt: string;
}

export interface AlertItem {
  id: string;
  titleAr: string;
  bodyAr: string;
  severity: 'info' | 'warning' | 'critical';
  neighborhoodId: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * A resident's referral stats. `invitesSent` counts share taps on this
 * device; `joinedCount` is server-attributed (referral_events
 * 'signup_attributed') and `null` until loaded — never a seeded number.
 */
export interface ReferralStats {
  invitesSent: number;
  joinedCount: number | null;
  code?: string;
}

// -------------------------------------------------------------- neighbors --

/** Interests residents can show on their profile (user_interests check constraint). */
export type Interest =
  | 'football'
  | 'padel'
  | 'running'
  | 'cycling'
  | 'walking'
  | 'fitness'
  | 'gaming'
  | 'reading'
  | 'coffee'
  | 'volunteering'
  | 'photography'
  | 'technology';

/** Relationship of the signed-in resident to another resident (server-computed). */
export type NeighborState = 'self' | 'none' | 'request_sent' | 'request_received' | 'connected' | 'blocked';

/** Privacy-first defaults: not discoverable until the resident opts in. */
export interface NeighborSettings {
  discoverable: boolean;
  allowRequests: boolean;
  showNeighborCount: boolean;
  showInterests: boolean;
  showSharedClubs: boolean;
  allowNeighborMessages: boolean;
}

export interface NeighborRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

export interface NeighborConnection {
  /** The other resident. */
  userId: string;
  since: string;
}

export interface EventInvitation {
  id: string;
  eventId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

/** A discoverable resident as returned by discover_neighbors (name already privacy-trimmed). */
export interface DiscoveredNeighbor {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  sharedInterests: Interest[];
  /** null when that resident hides their neighbor count. */
  mutualCount: number | null;
  state: NeighborState;
}

/** What the signed-in resident may know about one profile (neighbor_profile RPC). */
export interface NeighborProfileInfo {
  state: NeighborState;
  incomingRequestId: string | null;
  acceptsRequests: boolean;
  neighborCount: number | null;
  mutualCount: number | null;
  sharedInterests: Interest[];
  sharedClubs: { id: string; name: string }[];
  canMessage: boolean;
}
