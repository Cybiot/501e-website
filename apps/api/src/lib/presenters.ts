import type { MedalTier, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { stripRankPrefix } from './rank-prefix.js';
import { fileUrl } from './storage.js';

/**
 * Attribution officielle : annoncée sur Discord et non retirée. Avant l'annonce, une attribution
 * n'est visible que des admins (liste « À annoncer »).
 */
export const officialAward = { revokedAt: null, announcedAt: { not: null } } satisfies Prisma.MedalAwardWhereInput;

/** Sélection Prisma commune pour afficher un membre (carte « dog tag » et fiche). */
export const memberInclude = {
  rank: true,
  profile: { include: { customImage: true } },
  responsibilities: {
    include: { responsibility: true },
    orderBy: [{ responsibility: { order: 'asc' } }, { responsibility: { name: 'asc' } }],
  },
  awards: {
    where: officialAward,
    include: { medal: true },
    orderBy: { awardedAt: 'desc' },
  },
} satisfies Prisma.UserInclude;

export type MemberWithRelations = Prisma.UserGetPayload<{ include: typeof memberInclude }>;

export const avatarOf = (u: Pick<MemberWithRelations, 'discordAvatarUrl' | 'profile'>) =>
  u.profile?.customImage?.status === 'approved'
    ? fileUrl(u.profile.customImage.storageKey)
    : u.discordAvatarUrl;

export const presentRank = (r: MemberWithRelations['rank']) =>
  r
    ? { id: r.id, name: r.name, abbreviation: r.abbreviation, branch: r.branch, order: r.order, iconUrl: r.iconUrl }
    : null;

type MedalImages = { imageUrl: string; imageBronzeUrl: string | null; imageSilverUrl: string | null; imageGoldUrl: string | null };

/** Paliers du plus bas au plus haut. */
export const MEDAL_TIERS: MedalTier[] = ['bronze', 'silver', 'gold'];

/** Médaille à paliers : les trois images de palier sont renseignées. */
export const isTiered = (m: MedalImages) => !!(m.imageBronzeUrl && m.imageSilverUrl && m.imageGoldUrl);

/** Image à afficher pour un palier donné (image de base sans palier ou si la médaille n'en a pas). */
export function medalImageFor(m: MedalImages, tier: MedalTier | null | undefined) {
  const byTier = { bronze: m.imageBronzeUrl, silver: m.imageSilverUrl, gold: m.imageGoldUrl };
  return (tier && byTier[tier]) || m.imageUrl;
}

const tierRank = (t: MedalTier | null) => (t ? MEDAL_TIERS.indexOf(t) : -1);

export const presentMedal = (
  m: { id: string; name: string; description: string; category: string } & MedalImages,
  tier: MedalTier | null = null,
) => ({
  id: m.id,
  name: m.name,
  description: m.description,
  imageUrl: medalImageFor(m, tier),
  category: m.category,
  tiered: isTiered(m),
  tier: isTiered(m) ? tier : null,
});

/** Compagnies et leurs platoons, pour déduire l'affectation d'un membre de ses rôles Discord. */
export type CompanyIndex = {
  slug: string;
  name: string;
  discordRoleId: string | null;
  headquarters: boolean;
  platoons: { name: string; discordRoleId: string | null }[];
}[];

export const loadCompanyIndex = (): Promise<CompanyIndex> =>
  prisma.company.findMany({
    orderBy: { order: 'asc' },
    select: {
      slug: true,
      name: true,
      discordRoleId: true,
      headquarters: true,
      platoons: { orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { name: true, discordRoleId: true } },
    },
  });

/** Grades rattachés d'office à l'état-major (Lt.Col, Col). */
export const isStaffRank = (rank: { branch: string } | null | undefined) => rank?.branch === 'staff';

/**
 * Compagnie d'un membre : rôle de la compagnie ou de l'un de ses platoons (même règle que la page
 * compagnie). Si plusieurs correspondent, la première dans l'ordre l'emporte (le camp Toccoa,
 * dernier, ne s'affiche que pour qui n'est dans aucune compagnie de combat). L'état-major passe
 * après toutes les autres : un chef de pôle affiche sa compagnie, l'état-major ne s'affiche que
 * pour qui n'en a pas (Lt.Col, Col…).
 */
export function companyOf(roleIds: string[], rank: { branch: string } | null, companies: CompanyIndex) {
  const has = (id: string | null) => !!id && roleIds.includes(id);
  const ordered = [...companies.filter((c) => !c.headquarters), ...companies.filter((c) => c.headquarters)];
  for (const c of ordered) {
    const platoon = c.platoons.find((p) => has(p.discordRoleId));
    if (platoon || has(c.discordRoleId) || (c.headquarters && isStaffRank(rank))) {
      return { slug: c.slug, name: c.name, platoon: platoon?.name ?? null };
    }
  }
  return null;
}

/** Carte membre (liste) : informations publiques uniquement. */
export function presentMemberCard(u: MemberWithRelations, companies: CompanyIndex = []) {
  // Médailles regroupées : une entrée par médaille avec le nombre d'obtentions,
  // affichée au palier le plus haut obtenu.
  const grouped = new Map<string, { medal: ReturnType<typeof presentMedal>; count: number }>();
  for (const a of u.awards) {
    const g = grouped.get(a.medalId);
    if (!g) grouped.set(a.medalId, { medal: presentMedal(a.medal, a.tier), count: 1 });
    else {
      g.count++;
      if (tierRank(a.tier) > tierRank(g.medal.tier)) g.medal = presentMedal(a.medal, a.tier);
    }
  }
  const medals = [...grouped.values()].sort((a, b) => a.medal.name.localeCompare(b.medal.name));
  return {
    id: u.id,
    displayName: stripRankPrefix(u.displayName),
    avatarUrl: avatarOf(u),
    rank: presentRank(u.rank),
    tagline: u.profile?.tagline ?? null,
    responsibilities: u.responsibilities.map((r) => ({
      id: r.responsibility.id,
      name: r.responsibility.name,
      kind: r.responsibility.kind,
    })),
    medals,
    medalsTotal: u.awards.length,
    joinedAt: u.joinedAt,
    company: companyOf(u.discordRoleIds, u.rank, companies),
  };
}

/** Fiche membre : ajoute descriptions, dates et motifs des médailles. */
export function presentMemberDetail(u: MemberWithRelations, companies: CompanyIndex = []) {
  return {
    ...presentMemberCard(u, companies),
    responsibilities: u.responsibilities.map((r) => ({
      id: r.responsibility.id,
      name: r.responsibility.name,
      kind: r.responsibility.kind,
      description: r.responsibility.description,
    })),
    awards: u.awards.map((a) => ({
      id: a.id,
      medal: presentMedal(a.medal, a.tier),
      reason: a.reason,
      awardedAt: a.awardedAt,
    })),
  };
}
