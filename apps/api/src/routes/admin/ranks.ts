import { Router } from 'express';
import { z } from 'zod';
import { applyMemberInfo } from '../../auth/sync.js';
import { prisma } from '../../db.js';
import { discord } from '../../discord/index.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { presentRank } from '../../lib/presenters.js';
import { parse } from '../../lib/validate.js';
import { discordFailure } from './medals.js';

/**
 * Promotion ou rétrogradation décidée sur le site : le bot change le rôle de grade sur Discord
 * (qui reste la source de vérité), puis la copie locale est mise à jour comme lors d'une
 * synchronisation. Une montée rejoint donc la liste « À annoncer », une descente n'est pas annoncée.
 * Le changement peut sauter des grades (Pfc → Sgt, Lt.Col → Sgt).
 */
export const ranksAdminRouter = Router();

/** Grades attribuables : ceux associés à un rôle Discord, du plus haut au plus bas. */
ranksAdminRouter.get('/ranks', async (_req, res) => {
  const ranks = await prisma.rank.findMany({ where: { discordRoleId: { not: null } }, orderBy: { order: 'desc' } });
  res.json(ranks.map(presentRank));
});

const RankChangeBody = z.object({ rankId: z.string().min(1).max(40) });

ranksAdminRouter.post('/members/:id/rank', async (req, res) => {
  const id = parse(z.string().min(1).max(40), req.params.id);
  const { rankId } = parse(RankChangeBody, req.body);
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null, status: { in: ['member', 'admin'] } },
    include: { rank: true },
  });
  if (!user) throw notFound('Membre introuvable.');
  const target = await prisma.rank.findUnique({ where: { id: rankId } });
  if (!target) throw notFound('Grade introuvable.');
  if (!target.discordRoleId) {
    throw conflict("Ce grade n'est associé à aucun rôle Discord (Admin > Paramètres).", 'RANK_WITHOUT_ROLE');
  }
  if (user.rankId === target.id) throw conflict(`${user.displayName} est déjà ${target.name}.`, 'SAME_RANK');

  // Rôles relus sur Discord : la copie locale peut avoir quelques minutes de retard.
  let info;
  try {
    info = await discord().getMember(user.discordId);
  } catch (err) {
    throw await discordFailure(err, 'get_member', req);
  }
  if (!info) throw conflict(`${user.displayName} n'est plus sur le serveur Discord.`, 'NOT_ON_DISCORD');

  const rankRoleIds = new Set(
    (await prisma.rank.findMany({ where: { discordRoleId: { not: null } }, select: { discordRoleId: true } })).map((r) => r.discordRoleId!),
  );
  const toRemove = info.roles.filter((r) => rankRoleIds.has(r) && r !== target.discordRoleId);
  try {
    await discord().setRankRole(user.discordId, target.discordRoleId, toRemove);
  } catch (err) {
    throw await discordFailure(err, 'set_rank', req);
  }

  // Même traitement qu'un événement Discord : grade, détection de la promotion à annoncer.
  const roles = [...info.roles.filter((r) => !toRemove.includes(r) && r !== target.discordRoleId), target.discordRoleId];
  await applyMemberInfo(user.discordId, { ...info, roles });

  const direction = !user.rank || target.order > user.rank.order ? 'promotion' : 'demotion';
  await audit({
    action: direction === 'promotion' ? 'user.promoted' : 'user.demoted',
    req,
    targetType: 'user',
    targetId: user.id,
    metadata: { member: user.displayName, from: user.rank?.name ?? null, to: target.name },
  });
  res.json({ direction, fromRank: presentRank(user.rank), toRank: presentRank(target) });
});
