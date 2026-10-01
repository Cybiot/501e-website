/** Types des réponses de l'API (miroir des présentateurs côté serveur). */

export type UserStatus = 'visitor' | 'none' | 'member' | 'admin';

export interface Me {
  user: { id: string; discordId: string; displayName: string; avatarUrl: string | null } | null;
  status: UserStatus;
  consentRequired?: boolean;
  consent?: { version: string; text: string } | null;
}

/** Branches de progression, du plus bas au plus haut. */
export const RANK_BRANCHES = [
  { id: 'toccoa', label: 'Toccoa Bootcamp' },
  { id: 'enlisted', label: 'Homme du rang' },
  { id: 'platoon_leader', label: 'Platoon Leader' },
  { id: 'xo', label: 'XO' },
  { id: 'co', label: 'CO' },
  { id: 'staff', label: 'État-major' },
] as const;
export type RankBranch = (typeof RANK_BRANCHES)[number]['id'];

export interface Rank {
  id: string;
  name: string;
  abbreviation: string;
  branch: RankBranch;
  order: number;
  iconUrl?: string | null;
}

/** Palier d'une médaille (étoile bronze, argent ou or sur le ruban). */
export type MedalTier = 'bronze' | 'silver' | 'gold';

export const MEDAL_TIERS: MedalTier[] = ['bronze', 'silver', 'gold'];
export const TIER_LABELS: Record<MedalTier, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };

export interface Medal {
  id: string;
  name: string;
  description: string;
  /** Image correspondant au palier `tier` (image de base sans palier). */
  imageUrl: string;
  category: string;
  /** La médaille a-t-elle des paliers (bronze, argent, or) ? */
  tiered?: boolean;
  tier?: MedalTier | null;
}

/** Nom de la médaille suivi de son palier, ex. « Silver Star (Or) ». */
export const medalLabel = (m: Pick<Medal, 'name' | 'tier'>) => (m.tier ? `${m.name} (${TIER_LABELS[m.tier]})` : m.name);

/** Hiérarchie (EM, CO, XO, PL) ou pôle transverse (Staff Toccoa, Recruteur…). */
export type ResponsibilityKind = 'hierarchy' | 'pole';

export interface MemberCard {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  rank: Rank | null;
  tagline: string | null;
  responsibilities: { id: string; name: string; kind: ResponsibilityKind; description?: string }[];
  medals: { medal: Medal; count: number }[];
  medalsTotal: number;
  joinedAt: string | null;
}

export interface MemberDetail extends MemberCard {
  awards: { id: string; medal: Medal; reason: string; awardedAt: string }[];
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Filters {
  ranks: Rank[];
  responsibilities: { id: string; name: string; kind: ResponsibilityKind }[];
  medals: { id: string; name: string; imageUrl: string }[];
}

export interface PublicConfig {
  discordMode: 'mock' | 'live';
  inviteConfigured: boolean;
  map: { tileUrl: string; attribution: string; filter: 'dark' | 'none' };
}

export interface Featured {
  member: MemberCard;
  award: { medalName: string; medalImageUrl: string; tier: MedalTier | null; reason: string; awardedAt: string };
}

export interface Location {
  id: string;
  cityLabel: string;
  country: string;
  lat?: number;
  lng?: number;
}

export interface CitySuggestion {
  label: string;
  city: string;
  region: string | null;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface MapMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  rank: Rank | null;
  tagline: string | null;
  responsibilityIds: string[];
  locations: Required<Location>[];
}

export interface MyProfile extends MemberDetail {
  discordAvatarUrl: string | null;
  publicProfileEnabled: boolean;
  consents: {
    version: string | null;
    acceptedAt: string | null;
    customImage: boolean;
    location: boolean;
    history: { version: string; publicProfile: boolean; customImage: boolean; location: boolean; createdAt: string }[];
  };
  image: {
    approvedUrl: string | null;
    pending: { url: string; submittedAt: string } | null;
    rejected: { reason: string | null; reviewedAt: string | null } | null;
  };
  locations: Location[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// --- Administration ---------------------------------------------------------

export interface AdminMedal extends Medal {
  tierImages: Record<MedalTier, string> | null;
  order: number;
  isActive: boolean;
  repeatable: boolean;
  discordRoleId: string | null;
  awardsCount: number;
}

export interface AdminAward {
  id: string;
  reason: string;
  tier: MedalTier | null;
  awardedAt: string;
  announcedAt: string | null;
  revokedAt: string | null;
  member: { id: string; displayName: string; discordId: string };
  medal: Medal;
  awardedBy: { id: string; displayName: string } | null;
}

export interface MemberSearchResult {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  rank: Rank | null;
  medalIds: string[];
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  footer?: { text: string };
}

export interface AnnouncementPreview {
  channelId: string;
  awardsCount: number;
  names: Record<string, string>;
  messages: { content?: string; embeds: DiscordEmbed[] }[];
}

export interface AnnouncementHistory {
  id: string;
  createdAt: string;
  createdBy: { id: string; displayName: string } | null;
  channelId: string;
  messagesCount: number;
  awardsCount: number;
  awards: { member: string; medal: string; tier: MedalTier | null; reason: string }[];
}

export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  readBy: string | null;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actor: { id: string | null; displayName: string } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
}

export interface ModerationItem {
  id: string;
  url: string;
  submittedAt: string;
  member: {
    id: string;
    displayName: string;
    rank: Rank | null;
    discordAvatarUrl: string | null;
    currentImageUrl: string | null;
  };
}

export interface AppSettings {
  memberRoleIds: string[];
  adminRoleIds: string[];
  announceChannelId: string;
  inviteUrl: string;
  announceMentions: boolean;
  consentVersion: string;
  consentText: string;
}

export interface AdminRank extends Rank {
  discordRoleId: string | null;
  usersCount: number;
}

export interface AdminResponsibility {
  id: string;
  name: string;
  description: string;
  kind: ResponsibilityKind;
  order: number;
  discordRoleId: string | null;
  usersCount: number;
}
