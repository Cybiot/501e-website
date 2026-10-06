import type { MedalTier } from '@prisma/client';
import { prisma } from '../db.js';

export const IMPORT_REASON = 'Importée depuis son rôle Discord.';

/**
 * Crée les attributions des médailles que les membres portent déjà en rôle Discord (rôle de la
 * médaille ou d'un palier), d'après la copie locale de leurs rôles (`User.discordRoleIds`).
 * Palier : le plus haut porté (or > argent > bronze), sinon aucun. Les attributions sont
 * officielles d'emblée, sans annonce : le membre a déjà la médaille sur Discord.
 * Un membre qui a déjà une attribution de la médaille, même retirée, n'est pas touché : une
 * médaille retirée sur le site ne revient pas parce que le rôle est resté sur Discord.
 */
export async function importMedalsFromRoles(adminId: string) {
  const medals = await prisma.medal.findMany({
    select: { id: true, name: true, discordRoleId: true, discordRoleBronzeId: true, discordRoleSilverId: true, discordRoleGoldId: true },
  });
  const now = new Date();
  const created: { medal: string; userId: string; tier: MedalTier | null }[] = [];
  for (const m of medals) {
    const tierRoles: [MedalTier, string | null][] = [
      ['gold', m.discordRoleGoldId],
      ['silver', m.discordRoleSilverId],
      ['bronze', m.discordRoleBronzeId],
    ];
    const roleIds = [m.discordRoleId, ...tierRoles.map(([, r]) => r)].filter((r): r is string => !!r);
    if (!roleIds.length) continue;
    const holders = await prisma.user.findMany({
      where: { deletedAt: null, discordRoleIds: { hasSome: roleIds }, awards: { none: { medalId: m.id } } },
      select: { id: true, discordRoleIds: true },
    });
    for (const u of holders) {
      const tier = tierRoles.find(([, r]) => r && u.discordRoleIds.includes(r))?.[0] ?? null;
      await prisma.medalAward.create({
        data: { userId: u.id, medalId: m.id, reason: IMPORT_REASON, tier, awardedById: adminId, announcedAt: now },
      });
      created.push({ medal: m.name, userId: u.id, tier });
    }
  }
  return created;
}
