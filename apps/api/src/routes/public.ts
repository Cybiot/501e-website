import type { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { isMemberStatus } from '../auth/guards.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { notifyAdmins } from '../lib/notify.js';
import { memberInclude, presentMemberCard, presentMemberDetail } from '../lib/presenters.js';
import { getSettings } from '../lib/settings.js';
import { parse, toPage } from '../lib/validate.js';

export const publicRouter = Router();

/** Condition « membre visible » selon qui regarde (RGPD : profil masquable au public). */
export const visibleMembersWhere = (viewerIsMember: boolean): Prisma.UserWhereInput => ({
  status: { in: ['member', 'admin'] },
  deletedAt: null,
  ...(viewerIsMember ? {} : { publicProfileEnabled: true }),
});

publicRouter.get('/config', async (_req, res) => {
  const settings = await getSettings();
  res.json({
    discordMode: config.DISCORD_MODE,
    inviteConfigured: Boolean(settings.inviteUrl),
    map: { tileUrl: config.MAP_TILE_URL, attribution: config.MAP_TILE_ATTRIBUTION, filter: config.MAP_TILE_FILTER },
  });
});

publicRouter.get('/stats', async (_req, res) => {
  const [members, medalsAwarded] = await Promise.all([
    prisma.user.count({ where: visibleMembersWhere(true) }),
    prisma.medalAward.count({ where: { revokedAt: null, user: visibleMembersWhere(true) } }),
  ]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ members, medalsAwarded });
});

/** Référentiels pour les filtres de la liste des membres. */
publicRouter.get('/filters', async (_req, res) => {
  const [ranks, responsibilities, medals] = await Promise.all([
    prisma.rank.findMany({ orderBy: { order: 'desc' } }),
    prisma.responsibility.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.medal.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
  ]);
  res.json({
    ranks: ranks.map((r) => ({ id: r.id, name: r.name, abbreviation: r.abbreviation, order: r.order })),
    responsibilities: responsibilities.map((r) => ({ id: r.id, name: r.name })),
    medals: medals.map((m) => ({ id: m.id, name: m.name, imageUrl: m.imageUrl })),
  });
});

const ListQuery = z.object({
  q: z.string().trim().max(60).optional(),
  rank: z.string().max(40).optional(),
  responsibility: z.string().max(40).optional(),
  medal: z.string().max(40).optional(),
  sort: z.enum(['rank', 'seniority', 'alpha']).default('rank'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

publicRouter.get('/members', async (req, res) => {
  const q = parse(ListQuery, req.query);
  const where: Prisma.UserWhereInput = {
    ...visibleMembersWhere(isMemberStatus(req.user?.status)),
    ...(q.q ? { displayName: { contains: q.q, mode: 'insensitive' } } : {}),
    ...(q.rank ? { rankId: q.rank } : {}),
    ...(q.responsibility ? { responsibilities: { some: { responsibilityId: q.responsibility } } } : {}),
    ...(q.medal ? { awards: { some: { medalId: q.medal, revokedAt: null } } } : {}),
  };
  // Volume attendu : quelques centaines de membres → tri en mémoire, simple et lisible.
  const users = await prisma.user.findMany({ where, include: memberInclude });
  const byName = (a: (typeof users)[number], b: (typeof users)[number]) =>
    a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' });
  users.sort((a, b) => {
    if (q.sort === 'alpha') return byName(a, b);
    if (q.sort === 'seniority') {
      const d = (a.joinedAt?.getTime() ?? Infinity) - (b.joinedAt?.getTime() ?? Infinity);
      return d || byName(a, b);
    }
    const d = (b.rank?.order ?? -1) - (a.rank?.order ?? -1);
    return d || byName(a, b);
  });
  const start = (q.page - 1) * q.pageSize;
  res.json(toPage(users.slice(start, start + q.pageSize).map(presentMemberCard), users.length, q.page, q.pageSize));
});

/** Dernières décorations (accueil : « membres à l'honneur »). */
publicRouter.get('/members/featured', async (req, res) => {
  const awards = await prisma.medalAward.findMany({
    where: { revokedAt: null, user: visibleMembersWhere(isMemberStatus(req.user?.status)) },
    orderBy: { awardedAt: 'desc' },
    take: 20,
    include: { user: { include: memberInclude }, medal: true },
  });
  const seen = new Set<string>();
  const featured = [];
  for (const a of awards) {
    if (seen.has(a.userId)) continue;
    seen.add(a.userId);
    featured.push({
      member: presentMemberCard(a.user),
      award: { medalName: a.medal.name, medalImageUrl: a.medal.imageUrl, reason: a.reason, awardedAt: a.awardedAt },
    });
    if (featured.length >= 4) break;
  }
  res.json(featured);
});

publicRouter.get('/members/:id', async (req, res) => {
  const id = parse(z.string().min(1).max(40), req.params.id);
  const user = await prisma.user.findFirst({
    where: { id, ...visibleMembersWhere(isMemberStatus(req.user?.status)) },
    include: memberInclude,
  });
  // Profil masqué ou non-membre : 404 (on ne révèle pas son existence).
  if (!user) throw notFound('Membre introuvable.');
  res.json(presentMemberDetail(user));
});

/** Identifiants des fiches publiques, pour le sitemap. */
publicRouter.get('/sitemap/members', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: visibleMembersWhere(false),
    select: { id: true, updatedAt: true },
  });
  res.json(users);
});

// --- Bouton « Rejoindre la 501e » -----------------------------------------------------------

/** Limite par IP (en mémoire, jamais persistée) pour éviter le flood de notifications. */
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Au-delà de la limite, on redirige quand même : seule la notification est ignorée.
  handler: (req, _res, next) => {
    (req as { joinThrottled?: boolean }).joinThrottled = true;
    next();
  },
});

/** Regroupe les clics rapprochés dans une même notification non lue (anti-flood). */
async function recordJoinClick(discordId: string | undefined) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await prisma.notification.findFirst({
    where: { type: 'join_click', readAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const payload = recent.payload as { count?: number; discordIds?: string[] };
    const discordIds = [...new Set([...(payload.discordIds ?? []), ...(discordId ? [discordId] : [])])].slice(0, 20);
    await prisma.notification.update({
      where: { id: recent.id },
      data: { payload: { count: (payload.count ?? 1) + 1, discordIds } },
    });
  } else {
    // Événement anonyme : ni IP ni identifiant, sauf l'ID Discord si la personne est connectée.
    await notifyAdmins('join_click', { count: 1, discordIds: discordId ? [discordId] : [] });
  }
}

async function handleJoin(req: Request) {
  if (!(req as { joinThrottled?: boolean }).joinThrottled) {
    await recordJoinClick(req.user?.discordId);
  }
  const { inviteUrl } = await getSettings();
  return inviteUrl;
}

/** Version sans JavaScript : lien direct qui redirige vers l'invitation Discord. */
publicRouter.get('/join', joinLimiter, async (req, res) => {
  const url = await handleJoin(req);
  res.redirect(302, url || '/rejoindre?invitation=indisponible');
});

publicRouter.post('/join-click', joinLimiter, async (req, res) => {
  const url = await handleJoin(req);
  res.json({ url: url || null });
});
