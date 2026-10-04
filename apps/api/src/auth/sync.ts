import type { Prisma, UserStatus } from '@prisma/client';
import { discord } from '../discord/index.js';
import type { GuildMemberInfo } from '../discord/types.js';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { logger } from '../lib/logger.js';
import { notifyAdmins } from '../lib/notify.js';
import { getSettings, type AppSettings } from '../lib/settings.js';

/** Statut calculé à partir des rôles Discord. Admin > Membre > aucun. */
export function computeStatus(roles: string[], settings: Pick<AppSettings, 'memberRoleIds' | 'adminRoleIds'>): UserStatus {
  if (roles.some((r) => settings.adminRoleIds.includes(r))) return 'admin';
  if (roles.some((r) => settings.memberRoleIds.includes(r))) return 'member';
  return 'none';
}

/**
 * Applique les informations Discord d'un membre à la copie locale :
 * statut, grade (rôle de plus haut rang), responsabilités, pseudo, avatar.
 * `info = null` signifie que l'utilisateur n'est plus sur le serveur.
 */
export async function applyMemberInfo(discordId: string, info: GuildMemberInfo | null) {
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user || user.deletedAt) return null;

  const settings = await getSettings();
  const roles = info?.roles ?? [];
  const status = computeStatus(roles, settings);

  const ranks = await prisma.rank.findMany({ where: { discordRoleId: { in: roles } }, orderBy: { order: 'desc' } });
  const responsibilities = await prisma.responsibility.findMany({ where: { discordRoleId: { in: roles } } });

  const wasMember = user.status !== 'none';
  const isMember = status !== 'none';
  const newRank = ranks[0] ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    if (newRank && newRank.id !== user.lastKnownRankId) await trackPromotion(tx, user, newRank, isMember);
    await tx.userResponsibility.deleteMany({ where: { userId: user.id } });
    if (responsibilities.length) {
      await tx.userResponsibility.createMany({
        data: responsibilities.map((r) => ({ userId: user.id, responsibilityId: r.id })),
      });
    }
    return tx.user.update({
      where: { id: user.id },
      data: {
        status,
        discordRoleIds: roles,
        rankId: newRank?.id ?? null,
        // Sans grade (rôle retiré avant l'ajout du suivant) : on garde le dernier grade connu.
        lastKnownRankId: newRank?.id ?? user.lastKnownRankId,
        displayName: info?.displayName ?? user.displayName,
        discordAvatarUrl: info?.avatarUrl ?? user.discordAvatarUrl,
        joinedAt: info?.joinedAt ?? user.joinedAt,
        rolesSyncedAt: new Date(),
        // Départ : on masque immédiatement et on date le départ (purge différée). Retour : on efface.
        leftAt: isMember ? null : wasMember ? new Date() : user.leftAt,
      },
    });
  });

  if (user.status !== status) {
    await audit({
      action: 'user.status_changed',
      actorId: null,
      targetType: 'user',
      targetId: user.id,
      metadata: { from: user.status, to: status },
    });
    // Première synchronisation d'un membre = première connexion d'un nouveau membre.
    if (isMember && !user.rolesSyncedAt) {
      await notifyAdmins('new_member', { userId: user.id, displayName: updated.displayName });
    }
  }
  return updated;
}

/**
 * Changement de grade : une montée crée (ou met à jour) la promotion en attente d'annonce,
 * une descente l'annule. La comparaison part du grade d'avant la promotion en attente, pour
 * qu'une montée en deux temps (Pvt → Pfc → Cpl avant l'annonce) soit annoncée « Pvt → Cpl ».
 * Le premier grade connu d'un membre (import, première connexion) n'est pas une promotion.
 */
async function trackPromotion(
  tx: Prisma.TransactionClient,
  user: { id: string; lastKnownRankId: string | null },
  newRank: { id: string; order: number },
  isMember: boolean,
) {
  const pending = await tx.rankPromotion.findFirst({ where: { userId: user.id, announcedAt: null }, include: { fromRank: true } });
  const base = pending ? pending.fromRank : user.lastKnownRankId ? await tx.rank.findUnique({ where: { id: user.lastKnownRankId } }) : null;
  const promoted = isMember && base !== null && newRank.order > base.order;
  if (!promoted) {
    if (pending) await tx.rankPromotion.delete({ where: { id: pending.id } });
    return;
  }
  if (pending) await tx.rankPromotion.update({ where: { id: pending.id }, data: { toRankId: newRank.id, promotedAt: new Date() } });
  else await tx.rankPromotion.create({ data: { userId: user.id, fromRankId: base.id, toRankId: newRank.id } });
}

/** Relit les rôles d'un utilisateur via le bot. En cas d'échec Discord, on conserve la copie locale. */
export async function refreshUserRoles(discordId: string) {
  try {
    const info = await discord().getMember(discordId);
    return await applyMemberInfo(discordId, info);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Rafraîchissement des rôles impossible');
    return null;
  }
}

/** Synchronisation complète (job périodique) : tous les utilisateurs connus. */
export async function syncAllMembers() {
  const members = await discord().listMembers();
  const byId = new Map(members.map((m) => [m.discordId, m]));
  const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { discordId: true } });
  let changed = 0;
  for (const u of users) {
    const before = await prisma.user.findUnique({ where: { discordId: u.discordId }, select: { status: true } });
    const after = await applyMemberInfo(u.discordId, byId.get(u.discordId) ?? null);
    if (after && before?.status !== after.status) changed++;
  }
  return { users: users.length, changed };
}
