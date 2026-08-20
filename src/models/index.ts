// Core frontend data models for Haratna.
// These types describe the shape a future backend (e.g. Supabase) should
// fulfil. Every mock service returns data conforming to these models so the
// UI layer never needs to change when a real API is wired in.

export type Locale = 'ar' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';

export type DemoRole = 'resident' | 'moderator' | 'organizer' | 'business';

export type NamePrivacy = 'full' | 'first_last_initial' | 'first_only';

export interface City {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  popular?: boolean;
}

export interface Neighborhood {
  id: string;
  citySlug: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  residentsCount: number;
  eventsThisWeek: number;
  openIssues: number;
  helpfulActions: number;
  centerLat: number;
  centerLng: number;
}

export type VerificationStatus =
  | 'not_started'
  | 'checking'
  | 'pending'
  | 'verified'
  | 'failed';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  namePrivacy: NamePrivacy;
  neighborhoodId: string;
  verification: VerificationStatus;
  role: DemoRole;
  memberSince: string; // ISO date
  reputationTier: ReputationTier;
  stats: {
    neighborsHelped: number;
    eventsHosted: number;
    thanksReceived: number;
  };
  isSelf?: boolean;
}

export type ReputationTier =
  | 'new_neighbor'
  | 'neighbor'
  | 'contributor'
  | 'community_builder'
  | 'community_champion';

export interface ReputationEvent {
  id: string;
  userId: string;
  type: 'thanks' | 'helped' | 'hosted_event' | 'resolved_issue';
  reasonAr: string;
  fromUserId?: string;
  createdAt: string;
}

export type PostType =
  | 'general'
  | 'announcement'
  | 'issue'
  | 'help'
  | 'event'
  | 'poll'
  | 'recommendation'
  | 'lost_found'
  | 'marketplace'
  | 'alert';

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
  | 'streetlight'
  | 'road_damage'
  | 'trash'
  | 'water'
  | 'electricity'
  | 'flooding'
  | 'abandoned_vehicle'
  | 'safety'
  | 'other';

export type IssueStatus =
  | 'reported'
  | 'confirmed'
  | 'submitted'
  | 'under_review'
  | 'in_progress'
  | 'resolved';

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
  approxLat: number;
  approxLng: number;
}

export type HelpCategory =
  | 'car'
  | 'borrow_item'
  | 'moving'
  | 'lost_pet'
  | 'home'
  | 'other';

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
  | 'walking'
  | 'cleanup'
  | 'coffee'
  | 'iftar'
  | 'kids'
  | 'family'
  | 'community';

export type AttendeeStatus = 'not_joined' | 'going' | 'waitlisted' | 'interested' | 'cancelled';

export interface EventAttendee {
  userId: string;
  status: AttendeeStatus;
  joinedAt: string;
}

export interface CommunityEvent {
  id: string;
  title: string;
  category: EventCategory;
  coverImage: string;
  description: string;
  hostId: string;
  neighborhoodId: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string;
  approxLat: number;
  approxLng: number;
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
  votes: string[]; // userIds
}

export interface Poll {
  id: string;
  postId: string;
  question: string;
  options: PollOption[];
  closesAt: string;
  neighborhoodId: string;
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
  image: string;
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
  coverImage: string;
  logo?: string;
  description: string;
  neighborhoodIds: string[];
  hours: string;
  phoneMasked: string;
  communityVerified: boolean;
  recommendationCount: number;
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
  image: string;
  status: LostFoundStatus;
  neighborhoodId: string;
  authorId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  eventId?: string;
  isGroup?: boolean;
  title?: string;
  lastMessageAt: string;
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
  | 'marketplace_inquiry';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  titleAr: string;
  bodyAr: string;
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
  coverImage: string;
  verified: boolean;
  announcements: { id: string; textAr: string; createdAt: string }[];
  classes: { id: string; titleAr: string; schedule: string }[];
  volunteerOpportunities: { id: string; titleAr: string; spotsLeft: number }[];
}

export type ReportReason =
  | 'spam'
  | 'scam'
  | 'harassment'
  | 'privacy_violation'
  | 'inappropriate'
  | 'misinformation'
  | 'impersonation'
  | 'other';

export type ReportTargetType = 'post' | 'comment' | 'user' | 'listing';

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

export interface AlertItem {
  id: string;
  titleAr: string;
  bodyAr: string;
  severity: 'info' | 'warning' | 'critical';
  neighborhoodId: string;
  createdAt: string;
  followerIds: string[];
  helpfulBy: string[];
}
