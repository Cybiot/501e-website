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
  /** Compagnie déduite des rôles Discord (rôle de la compagnie ou d'un de ses platoons). */
  company: { slug: string; name: string; platoon: string | null } | null;
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
  /** Phrase proposée en attente de validation, ou motif du dernier refus. */
  taglineModeration: {
    pending: { text: string; submittedAt: string } | null;
    rejected: { reason: string; reviewedAt: string | null } | null;
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
  /** Attributions officielles (annoncées, non retirées). */
  awardsCount: number;
  /** Aucune attribution, même en attente ou retirée : la médaille peut être supprimée. */
  deletable: boolean;
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

/** Montée en grade détectée sur Discord, en attente d'annonce. */
export interface AdminPromotion {
  id: string;
  promotedAt: string;
  member: { id: string; displayName: string; discordId: string };
  fromRank: Rank | null;
  toRank: Rank;
}

/** Résultat d'une promotion ou rétrogradation décidée depuis l'admin. */
export interface RankChangeResult {
  direction: 'promotion' | 'demotion';
  fromRank: Rank | null;
  toRank: Rank;
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
  promotionsCount: number;
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
  promotionsCount: number;
  awards: { member: string; medal: string; tier: MedalTier | null; reason: string }[];
  promotions: { member: string; from: string | null; to: string }[];
}

/** Issue d'une demande de modération, inscrite dans la notification correspondante. */
export interface ModerationOutcome {
  status: 'approved' | 'rejected' | 'replaced' | 'withdrawn';
  at: string;
  by?: string;
  reason?: string;
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

export interface TaglineModerationItem {
  userId: string;
  text: string;
  submittedAt: string;
  currentText: string | null;
  member: {
    id: string;
    displayName: string;
    rank: Rank | null;
    discordAvatarUrl: string | null;
  };
}

export interface AppSettings {
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

/** Rôle de commandement dans une compagnie (responsabilités CO, XO, PL). */
export type CommandRole = 'co' | 'xo' | 'pl';

/** Effectif d'une compagnie, groupé par platoon (barre latérale de la page compagnie). */
export interface CompanyRoster {
  slug: string;
  name: string;
  memberCount: number;
  groups: {
    id: string;
    name: string;
    members: { id: string; displayName: string; avatarUrl: string | null; rank: Rank | null; command: CommandRole | null }[];
  }[];
}

export interface AdminPlatoon {
  id: string;
  companyId: string;
  name: string;
  order: number;
  discordRoleId: string | null;
}

export interface AdminCompany {
  id: string;
  slug: string;
  name: string;
  order: number;
  discordRoleId: string | null;
  /** État-major : rôle des chefs de pôle, Lt.Col et Col d'office, pas de platoons. */
  headquarters: boolean;
  platoons: AdminPlatoon[];
}

export interface AdminResponsibility {
  id: string;
  name: string;
  description: string;
  kind: ResponsibilityKind;
  order: number;
  discordRoleId: string | null;
  /** Attribuée d'office aux grades de cette branche (ex. PL : Sgt, S/Sgt, Sfc). */
  rankBranch: RankBranch | null;
  usersCount: number;
}

/**
 * Nom précédé de l'abréviation du grade : « Col. John Martin » (nom seul sans grade).
 * Si le pseudo commence déjà par ce grade (« Col. » ou « COL »), il n'est pas répété.
 */
export function rankedName(member: Pick<MemberCard, 'displayName' | 'rank'>): string {
  const abbr = member.rank?.abbreviation?.trim();
  if (!abbr) return member.displayName;
  const bare = abbr.replace(/\.$/, '').toLowerCase();
  const first = member.displayName.trim().split(/\s+/)[0]!.replace(/\.$/, '').toLowerCase();
  return first === bare ? member.displayName : `${abbr} ${member.displayName}`;
}
