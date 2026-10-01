import type { MedalTier, Prisma } from '@prisma/client';
import { stripRankPrefix } from './rank-prefix.js';
import { fileUrl } from './storage.js';

/** Sélection Prisma commune pour afficher un membre (carte « dog tag » et fiche). */
export const memberInclude = {
  rank: true,
  profile: { include: { customImage: true } },
  responsibilities: {
    include: { responsibility: true },
    orderBy: [{ responsibility: { order: 'asc' } }, { responsibility: { name: 'asc' } }],
  },
  awards: {
    where: { revokedAt: null },
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

/** Carte membre (liste) : informations publiques uniquement. */
export function presentMemberCard(u: MemberWithRelations) {
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
  };
}

/** Fiche membre : ajoute descriptions, dates et motifs des médailles. */
export function presentMemberDetail(u: MemberWithRelations) {
  return {
    ...presentMemberCard(u),
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
