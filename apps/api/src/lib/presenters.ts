import type { Prisma } from '@prisma/client';
import { fileUrl } from './storage.js';

/** Sélection Prisma commune pour afficher un membre (carte « dog tag » et fiche). */
export const memberInclude = {
  rank: true,
  profile: { include: { customImage: true } },
  responsibilities: { include: { responsibility: true } },
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
  r ? { id: r.id, name: r.name, abbreviation: r.abbreviation, order: r.order, iconUrl: r.iconUrl } : null;

export const presentMedal = (m: {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
}) => ({ id: m.id, name: m.name, description: m.description, imageUrl: m.imageUrl, category: m.category });

/** Carte membre (liste) : informations publiques uniquement. */
export function presentMemberCard(u: MemberWithRelations) {
  // Médailles regroupées : une entrée par médaille avec le nombre d'obtentions.
  const grouped = new Map<string, { medal: ReturnType<typeof presentMedal>; count: number }>();
  for (const a of u.awards) {
    const g = grouped.get(a.medalId);
    if (g) g.count++;
    else grouped.set(a.medalId, { medal: presentMedal(a.medal), count: 1 });
  }
  const medals = [...grouped.values()].sort((a, b) => a.medal.name.localeCompare(b.medal.name));
  return {
    id: u.id,
    displayName: u.displayName,
    avatarUrl: avatarOf(u),
    rank: presentRank(u.rank),
    tagline: u.profile?.tagline ?? null,
    responsibilities: u.responsibilities.map((r) => ({
      id: r.responsibility.id,
      name: r.responsibility.name,
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
      description: r.responsibility.description,
    })),
    awards: u.awards.map((a) => ({
      id: a.id,
      medal: presentMedal(a.medal),
      reason: a.reason,
      awardedAt: a.awardedAt,
    })),
  };
}
