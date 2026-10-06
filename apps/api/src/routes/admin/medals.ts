import { Prisma, type Medal } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { syncAllMembers } from '../../auth/sync.js';
import { discord } from '../../discord/index.js';
import { MEDAL_CATEGORIES } from '../../data/medals.js';
import { buildAnnouncementMessages } from '../../lib/announcement.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { importMedalsFromRoles } from '../../lib/medal-import.js';
import { notifyAdmins } from '../../lib/notify.js';
import { avatarOf, isTiered, officialAward, presentMedal, presentRank } from '../../lib/presenters.js';
import { getSettings } from '../../lib/settings.js';
import { deleteFile, fileUrl, storeMedalImage } from '../../lib/storage.js';
import { parse } from '../../lib/validate.js';

export const medalsAdminRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 4 } });

/** Une image par palier (bronze, argent, or), en plus de l'image de base. */
const TIER_IMAGE_FIELDS = [
  { field: 'imageBronze', column: 'imageBronzeUrl' },
  { field: 'imageSilver', column: 'imageSilverUrl' },
  { field: 'imageGold', column: 'imageGoldUrl' },
] as const;
type ImageField = 'image' | (typeof TIER_IMAGE_FIELDS)[number]['field'];
type ImageColumn = 'imageUrl' | (typeof TIER_IMAGE_FIELDS)[number]['column'];

const medalUpload = upload.fields([{ name: 'image', maxCount: 1 }, ...TIER_IMAGE_FIELDS.map((t) => ({ name: t.field, maxCount: 1 }))]);
const fileOf = (req: Request, field: ImageField) =>
  (req.files as Partial<Record<ImageField, Express.Multer.File[]>> | undefined)?.[field]?.[0];

/** Un rôle Discord par palier, en plus du rôle de la médaille. */
const TIER_ROLE_FIELDS = [
  { tier: 'bronze', column: 'discordRoleBronzeId' },
  { tier: 'silver', column: 'discordRoleSilverId' },
  { tier: 'gold', column: 'discordRoleGoldId' },
] as const;
const ROLE_COLUMNS = ['discordRoleId', ...TIER_ROLE_FIELDS.map((t) => t.column)] as const;
type RoleColumn = (typeof ROLE_COLUMNS)[number];

const imageUrlsOf = (m: Pick<Medal, ImageColumn>) =>
  [m.imageUrl, m.imageBronzeUrl, m.imageSilverUrl, m.imageGoldUrl].filter((u): u is string => !!u);

const PARTIAL_TIERS = 'Une médaille à paliers doit avoir ses trois images de palier (bronze, argent et or).';

/** Erreur Discord : journalisée, notifiée aux admins, renvoyée en 502 pour permettre de réessayer. */
export async function discordFailure(err: unknown, action: string, req: Parameters<typeof audit>[0]['req']) {
  const message = (err as Error).message;
  logger.error({ err: message, action }, 'Action Discord en échec');
  await audit({ action: 'discord.error', req, metadata: { action, message } });
  await notifyAdmins('discord_error', { action, message });
  return new HttpError(502, 'DISCORD_ERROR', `Discord n'a pas pu exécuter l'action (${message}). Réessaie dans un instant.`);
}

const storedKeyOf = (imageUrl: string) =>
  imageUrl.startsWith('/api/files/') ? imageUrl.slice('/api/files/'.length) : null;

// --- Rôles Discord (listes déroulantes) ---------------------------------------------------------

medalsAdminRouter.get('/discord/roles', async (req, res) => {
  try {
    res.json(await discord().listRoles());
  } catch (err) {
    throw await discordFailure(err, 'list_roles', req);
  }
});

// --- Catalogue ------------------------------------------------------------------------------------

medalsAdminRouter.get('/medals', async (_req, res) => {
  const medals = await prisma.medal.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { awards: { where: officialAward } } } },
  });
  // Une médaille ne se supprime que si elle n'a aucune attribution, même en attente ou retirée.
  const used = new Set((await prisma.medalAward.groupBy({ by: ['medalId'] })).map((g) => g.medalId));
  res.json({
    categories: MEDAL_CATEGORIES,
    items: medals.map((m) => ({
      ...presentMedal(m),
      tierImages: isTiered(m) ? { bronze: m.imageBronzeUrl, silver: m.imageSilverUrl, gold: m.imageGoldUrl } : null,
      order: m.order,
      isActive: m.isActive,
      repeatable: m.repeatable,
      discordRoleId: m.discordRoleId,
      tierRoles: isTiered(m)
        ? { bronze: m.discordRoleBronzeId, silver: m.discordRoleSilverId, gold: m.discordRoleGoldId }
        : null,
      awardsCount: m._count.awards,
      deletable: !used.has(m.id),
    })),
  });
});

const boolField = z.preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean());

const roleField = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const MedalFields = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(500),
  category: z.string().trim().min(2).max(40),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  repeatable: boolField.default(true),
  isActive: boolField.default(true),
  /** Retire les images de palier : la médaille redevient sans palier. */
  removeTiers: boolField.default(false),
  /**
   * Rôle Discord existant associé à la médaille ; vide : aucun rôle. Absent à la création : un
   * rôle sans permission est créé au nom de la médaille ; absent en modification : inchangé.
   */
  discordRoleId: roleField,
  /** Rôles des paliers (vide : aucun ; absent : inchangé). Retirés avec les paliers. */
  discordRoleBronzeId: roleField,
  discordRoleSilverId: roleField,
  discordRoleGoldId: roleField,
});

/**
 * Un rôle Discord ne désigne qu'une seule médaille, ou un seul palier : ni deux fois dans la
 * même médaille, ni déjà pris par une autre (rôle de base ou de palier).
 */
async function assertRolesFree(roles: Partial<Record<RoleColumn, string | null>>, medalId?: string) {
  const ids = Object.values(roles).filter((r): r is string => !!r);
  if (new Set(ids).size !== ids.length) throw conflict('Un même rôle Discord est choisi deux fois pour cette médaille.');
  if (!ids.length) return;
  const other = await prisma.medal.findFirst({
    where: {
      OR: ROLE_COLUMNS.map((c) => ({ [c]: { in: ids } })),
      NOT: medalId ? { id: medalId } : undefined,
    },
  });
  if (other) throw conflict(`Ce rôle Discord est déjà associé à la médaille « ${other.name} ».`);
}

/** Stocke les images envoyées ; `cleanup` les supprime si la suite de l'opération échoue. */
async function storeImages(req: Request) {
  const stored: Partial<Record<ImageColumn, string>> = {};
  const keys: string[] = [];
  const cleanup = () => Promise.all(keys.map(deleteFile));
  const fields = [{ field: 'image', column: 'imageUrl' } as const, ...TIER_IMAGE_FIELDS];
  try {
    for (const { field, column } of fields) {
      const file = fileOf(req, field);
      if (!file) continue;
      const key = await storeMedalImage(file.buffer);
      keys.push(key);
      stored[column] = fileUrl(key);
    }
  } catch (err) {
    await cleanup();
    throw err;
  }
  return { stored, cleanup };
}

medalsAdminRouter.post('/medals', medalUpload, async (req, res) => {
  const body = parse(MedalFields, req.body);
  if (!fileOf(req, 'image')) throw badRequest("L'image de la médaille est obligatoire.");
  const tierFiles = TIER_IMAGE_FIELDS.filter((t) => fileOf(req, t.field)).length;
  if (tierFiles !== 0 && tierFiles !== TIER_IMAGE_FIELDS.length) throw badRequest(PARTIAL_TIERS);
  if (await prisma.medal.findUnique({ where: { name: body.name } })) {
    throw conflict('Une médaille porte déjà ce nom.');
  }
  // Rôles de palier : seulement pour une médaille à paliers (les trois images envoyées).
  const tierRoles = Object.fromEntries(
    TIER_ROLE_FIELDS.map(({ column }) => [column, tierFiles ? (body[column] ?? null) : null]),
  ) as Record<(typeof TIER_ROLE_FIELDS)[number]['column'], string | null>;
  await assertRolesFree({ discordRoleId: body.discordRoleId, ...tierRoles });
  const { stored, cleanup } = await storeImages(req);
  // Rôle Discord de la médaille : rôle existant choisi, aucun, ou créé sans aucune permission.
  let discordRoleId = body.discordRoleId ?? null;
  if (body.discordRoleId === undefined) {
    try {
      discordRoleId = await discord().createRole(body.name);
    } catch (err) {
      await cleanup();
      throw await discordFailure(err, 'create_medal_role', req);
    }
  }
  const medal = await prisma.medal.create({
    data: {
      name: body.name,
      discordRoleId,
      ...tierRoles,
      description: body.description,
      category: body.category,
      order: body.order,
      repeatable: body.repeatable,
      isActive: body.isActive,
      imageUrl: stored.imageUrl!,
      imageBronzeUrl: stored.imageBronzeUrl ?? null,
      imageSilverUrl: stored.imageSilverUrl ?? null,
      imageGoldUrl: stored.imageGoldUrl ?? null,
    },
  });
  await audit({ action: 'medal.created', req, targetType: 'medal', targetId: medal.id, metadata: { name: medal.name, discordRoleId } });
  res.status(201).json(presentMedal(medal));
});

medalsAdminRouter.patch('/medals/:id', medalUpload, async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const medal = await prisma.medal.findUnique({ where: { id } });
  if (!medal) throw notFound('Médaille introuvable.');
  const body = parse(MedalFields.partial(), req.body);
  // Paliers : retirés tous ensemble, ou remplacés image par image (les trois restent renseignées).
  const tiersAfter = body.removeTiers
    ? 0
    : TIER_IMAGE_FIELDS.filter((t) => fileOf(req, t.field) || medal[t.column]).length;
  if (tiersAfter !== 0 && tiersAfter !== TIER_IMAGE_FIELDS.length) throw badRequest(PARTIAL_TIERS);
  // Rôles après modification : ceux envoyés, sinon les actuels ; ceux des paliers seulement s'il y en a.
  const roles = Object.fromEntries(
    ROLE_COLUMNS.map((c) => [
      c,
      !tiersAfter && c !== 'discordRoleId' ? null : body[c] === undefined ? medal[c] : body[c],
    ]),
  ) as Record<RoleColumn, string | null>;
  await assertRolesFree(roles, id);
  const { stored } = await storeImages(req);
  const tierData = Object.fromEntries(
    TIER_IMAGE_FIELDS.map(({ column }) => [column, body.removeTiers ? null : (stored[column] ?? medal[column])]),
  );
  const updated = await prisma.medal.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      category: body.category,
      order: body.order,
      repeatable: body.repeatable,
      isActive: body.isActive,
      ...roles,
      ...(stored.imageUrl ? { imageUrl: stored.imageUrl } : {}),
      ...tierData,
    },
  });
  // Images remplacées ou retirées : supprimées du stockage (les images statiques du site restent).
  const kept = new Set(imageUrlsOf(updated));
  for (const url of imageUrlsOf(medal)) {
    const old = storedKeyOf(url);
    if (old && !kept.has(url)) await deleteFile(old);
  }
  await audit({ action: 'medal.updated', req, targetType: 'medal', targetId: id, metadata: { fields: Object.keys(body) } });
  res.json(presentMedal(updated));
});

/**
 * Import des médailles déjà portées en rôle Discord : rôles des membres relus d'abord, puis une
 * attribution (officielle, sans annonce) par médaille portée et pas encore attribuée sur le site.
 */
medalsAdminRouter.post('/medals/import-roles', async (req, res) => {
  try {
    await syncAllMembers();
  } catch (err) {
    throw await discordFailure(err, 'import_medal_roles', req);
  }
  const created = await importMedalsFromRoles(req.user!.id);
  const members = new Set(created.map((c) => c.userId)).size;
  await audit({ action: 'medal.imported', req, metadata: { awards: created.length, members } });
  res.json({ awards: created.length, members });
});

/** Suppression uniquement si la médaille n'a jamais été attribuée (sinon : désactivation). */
medalsAdminRouter.delete('/medals/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const medal = await prisma.medal.findUnique({ where: { id }, include: { _count: { select: { awards: true } } } });
  if (!medal) throw notFound('Médaille introuvable.');
  if (medal._count.awards > 0) {
    throw conflict('Cette médaille a déjà été attribuée : désactive-la plutôt que de la supprimer.', 'MEDAL_IN_USE');
  }
  await prisma.medal.delete({ where: { id } });
  for (const url of imageUrlsOf(medal)) {
    const key = storedKeyOf(url);
    if (key) await deleteFile(key);
  }
  await audit({ action: 'medal.deleted', req, targetType: 'medal', targetId: id, metadata: { name: medal.name } });
  res.status(204).end();
});

// --- Attribution -----------------------------------------------------------------------------------

/** Autocomplétion des membres (avec les médailles déjà détenues, pour prévenir les doublons). */
medalsAdminRouter.get('/members/search', async (req, res) => {
  const q = parse(z.string().trim().max(60).default(''), req.query.q);
  const users = await prisma.user.findMany({
    where: {
      status: { in: ['member', 'admin'] },
      deletedAt: null,
      ...(q ? { displayName: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: { rank: true, profile: { include: { customImage: true } }, awards: { where: { revokedAt: null }, select: { medalId: true } } },
    orderBy: { displayName: 'asc' },
    take: 15,
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      avatarUrl: avatarOf(u),
      rank: presentRank(u.rank),
      medalIds: u.awards.map((a) => a.medalId),
    })),
  );
});

const AwardBody = z.object({
  userId: z.string().min(1).max(40),
  medalId: z.string().min(1).max(40),
  reason: z.string().trim().min(3, 'Le motif est obligatoire.').max(200, '200 caractères maximum.'),
  /** Palier, pour une médaille à paliers ; absent ou null : image de base. */
  tier: z.enum(['bronze', 'silver', 'gold']).nullish(),
  idempotencyKey: z.string().min(8).max(64),
  /** Confirmation explicite pour attribuer à nouveau une médaille déjà détenue. */
  confirmDuplicate: z.boolean().optional(),
});

const presentAward = (a: Prisma.MedalAwardGetPayload<{ include: { user: true; medal: true; awardedBy: true } }>) => ({
  id: a.id,
  reason: a.reason,
  tier: a.tier,
  awardedAt: a.awardedAt,
  announcedAt: a.announcedAt,
  revokedAt: a.revokedAt,
  member: { id: a.user.id, displayName: a.user.displayName, discordId: a.user.discordId },
  medal: presentMedal(a.medal, a.tier),
  awardedBy: a.awardedBy ? { id: a.awardedBy.id, displayName: a.awardedBy.displayName } : null,
});
const awardInclude = { user: true, medal: true, awardedBy: true } as const;

/**
 * Verrou par (membre, médaille) : deux clics simultanés sont traités l'un après l'autre,
 * le second retrouve alors l'attribution du premier via sa clé d'idempotence.
 * (Suffisant pour une instance unique de l'API, cas prévu par le docker-compose.)
 */
const awardLocks = new Map<string, Promise<unknown>>();
async function withAwardLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = awardLocks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  awardLocks.set(key, run);
  try {
    return await run;
  } finally {
    if (awardLocks.get(key) === run) awardLocks.delete(key);
  }
}

medalsAdminRouter.post('/awards', async (req, res) => {
  const body = parse(AwardBody, req.body);
  await withAwardLock(`${body.userId}:${body.medalId}`, () => createAward(req, res, body));
});

async function createAward(req: Request, res: Response, body: z.infer<typeof AwardBody>) {

  // Idempotence : un double-clic renvoie l'attribution déjà créée.
  const same = await prisma.medalAward.findUnique({ where: { idempotencyKey: body.idempotencyKey }, include: awardInclude });
  if (same) {
    res.status(200).json(presentAward(same));
    return;
  }

  const [user, medal] = await Promise.all([
    prisma.user.findFirst({ where: { id: body.userId, status: { in: ['member', 'admin'] }, deletedAt: null } }),
    prisma.medal.findUnique({ where: { id: body.medalId } }),
  ]);
  if (!user) throw notFound('Membre introuvable.');
  if (!medal || !medal.isActive) throw notFound('Médaille introuvable ou désactivée.');
  if (body.tier && !isTiered(medal)) throw badRequest("Cette médaille n'a pas de paliers.");

  const alreadyHeld = await prisma.medalAward.count({ where: { userId: user.id, medalId: medal.id, revokedAt: null } });
  if (alreadyHeld > 0 && !medal.repeatable) {
    throw conflict(`${user.displayName} possède déjà cette médaille (non cumulable).`, 'ALREADY_AWARDED');
  }
  if (alreadyHeld > 0 && !body.confirmDuplicate) {
    throw conflict(
      `${user.displayName} possède déjà cette médaille (${alreadyHeld}×). Confirme pour l'attribuer à nouveau.`,
      'CONFIRM_DUPLICATE',
      { count: alreadyHeld },
    );
  }

  // Les médailles vivent sur le site uniquement : le bot n'ajoute aucun rôle Discord.
  try {
    const award = await prisma.medalAward.create({
      data: {
        userId: user.id,
        medalId: medal.id,
        reason: body.reason,
        tier: body.tier ?? null,
        awardedById: req.user!.id,
        idempotencyKey: body.idempotencyKey,
      },
      include: awardInclude,
    });
    await audit({
      action: 'medal.awarded',
      req,
      targetType: 'user',
      targetId: user.id,
      metadata: { awardId: award.id, medal: medal.name, tier: award.tier, reason: body.reason },
    });
    res.status(201).json(presentAward(award));
  } catch (err) {
    // Deux requêtes simultanées avec la même clé : on renvoie celle qui a gagné.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.medalAward.findUniqueOrThrow({ where: { idempotencyKey: body.idempotencyKey }, include: awardInclude });
      res.status(200).json(presentAward(existing));
      return;
    }
    throw err;
  }
}

/** Attributions enregistrées depuis la dernière annonce. */
medalsAdminRouter.get('/awards/pending', async (_req, res) => {
  const awards = await prisma.medalAward.findMany({
    where: { announcedAt: null, revokedAt: null },
    include: awardInclude,
    orderBy: { awardedAt: 'asc' },
  });
  res.json(awards.map(presentAward));
});

/** Historique des attributions (toutes, y compris retirées). */
medalsAdminRouter.get('/awards', async (req, res) => {
  const userId = parse(z.string().max(40).optional(), req.query.userId);
  const awards = await prisma.medalAward.findMany({
    where: userId ? { userId } : {},
    include: awardInclude,
    orderBy: { awardedAt: 'desc' },
    take: 200,
  });
  res.json(awards.map(presentAward));
});

/**
 * Retrait d'une attribution. Pas encore annoncée (liste « À annoncer ») : elle est supprimée,
 * l'attribution n'ayant jamais été officielle. Déjà annoncée : désattribution, la médaille
 * disparaît du site mais l'attribution reste dans l'historique (sans annonce Discord).
 */
medalsAdminRouter.delete('/awards/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const award = await prisma.medalAward.findUnique({ where: { id }, include: { medal: true } });
  if (!award || award.revokedAt) throw notFound('Attribution introuvable.');
  const announced = award.announcedAt !== null;
  if (announced) {
    await prisma.medalAward.update({ where: { id }, data: { revokedAt: new Date(), revokedById: req.user!.id } });
  } else {
    await prisma.medalAward.delete({ where: { id } });
  }
  await audit({
    action: 'medal.revoked',
    req,
    targetType: 'user',
    targetId: award.userId,
    metadata: { awardId: id, medal: award.medal.name, tier: award.tier, announced },
  });
  res.status(204).end();
});

/** Récipiendaires d'une médaille : attributions officielles (annoncées, non retirées). */
medalsAdminRouter.get('/medals/:id/awards', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const awards = await prisma.medalAward.findMany({
    where: { medalId: id, ...officialAward },
    include: awardInclude,
    orderBy: [{ user: { displayName: 'asc' } }, { announcedAt: 'asc' }],
  });
  res.json(awards.map(presentAward));
});

// --- Promotions (détectées par la synchronisation des rôles) -----------------------------------

const promotionInclude = { user: true, fromRank: true, toRank: true } as const;
/** Promotions en attente, limitées aux personnes toujours membres. */
const pendingPromotionsWhere = {
  announcedAt: null,
  user: { status: { in: ['member', 'admin'] }, deletedAt: null },
} satisfies Prisma.RankPromotionWhereInput;

const presentPromotion = (p: Prisma.RankPromotionGetPayload<{ include: typeof promotionInclude }>) => ({
  id: p.id,
  promotedAt: p.promotedAt,
  member: { id: p.user.id, displayName: p.user.displayName, discordId: p.user.discordId },
  fromRank: presentRank(p.fromRank),
  toRank: presentRank(p.toRank),
});

medalsAdminRouter.get('/promotions/pending', async (_req, res) => {
  const promotions = await prisma.rankPromotion.findMany({
    where: pendingPromotionsWhere,
    include: promotionInclude,
    orderBy: { promotedAt: 'asc' },
  });
  res.json(promotions.map(presentPromotion));
});

/** « Ne pas annoncer » : la promotion quitte la file (le grade, lui, reste celui de Discord). */
medalsAdminRouter.delete('/promotions/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const p = await prisma.rankPromotion.findUnique({ where: { id }, include: promotionInclude });
  if (!p || p.announcedAt) throw notFound('Promotion introuvable.');
  await prisma.rankPromotion.delete({ where: { id } });
  await audit({
    action: 'promotion.dismissed',
    req,
    targetType: 'user',
    targetId: p.userId,
    metadata: { from: p.fromRank?.name ?? null, to: p.toRank.name },
  });
  res.status(204).end();
});

// --- Annonce Discord ----------------------------------------------------------------------------

async function pendingForAnnouncement() {
  const [awards, promotions] = await Promise.all([
    prisma.medalAward.findMany({
      where: { announcedAt: null, revokedAt: null },
      include: { user: true, medal: true },
      orderBy: { awardedAt: 'asc' },
    }),
    prisma.rankPromotion.findMany({ where: pendingPromotionsWhere, include: promotionInclude, orderBy: { promotedAt: 'asc' } }),
  ]);
  return { awards, promotions };
}

medalsAdminRouter.get('/announcements/preview', async (_req, res) => {
  const [pending, settings] = await Promise.all([pendingForAnnouncement(), getSettings()]);
  const messages = buildAnnouncementMessages(pending, { mentions: settings.announceMentions, siteUrl: config.PUBLIC_URL });
  const users = [...pending.awards, ...pending.promotions].map((x) => x.user);
  res.json({
    channelId: settings.announceChannelId,
    awardsCount: pending.awards.length,
    promotionsCount: pending.promotions.length,
    // Pour l'aperçu : on remplace les mentions par les pseudos.
    names: Object.fromEntries(users.map((u) => [u.discordId, u.displayName])),
    messages: messages.map(({ content, embeds }) => ({ content, embeds })),
  });
});

let announcing = false;

medalsAdminRouter.post('/announcements', async (req, res) => {
  if (announcing) throw conflict('Une annonce est déjà en cours de publication.', 'ANNOUNCE_IN_PROGRESS');
  announcing = true;
  try {
    const [pending, settings] = await Promise.all([pendingForAnnouncement(), getSettings()]);
    if (pending.awards.length === 0 && pending.promotions.length === 0) {
      throw conflict('Rien à annoncer.', 'NOTHING_TO_ANNOUNCE');
    }
    if (!settings.announceChannelId) throw badRequest("Aucun salon d'annonce configuré (Admin > Paramètres).");

    const messages = buildAnnouncementMessages(pending, { mentions: settings.announceMentions, siteUrl: config.PUBLIC_URL });
    const sentIds: string[] = [];
    const announcedAwardIds: string[] = [];
    const announcedPromotionIds: string[] = [];
    let failure: unknown = null;
    for (const m of messages) {
      try {
        sentIds.push(await discord().postAnnouncement(m));
        announcedAwardIds.push(...m.awardIds);
        announcedPromotionIds.push(...m.promotionIds);
      } catch (err) {
        failure = err;
        break;
      }
    }
    if (sentIds.length === 0) throw await discordFailure(failure, 'announce', req);

    const announcement = await prisma.$transaction(async (tx) => {
      const a = await tx.announcement.create({
        data: {
          createdById: req.user!.id,
          discordMessageIds: sentIds,
          channelId: settings.announceChannelId,
          awardsCount: announcedAwardIds.length,
          promotionsCount: announcedPromotionIds.length,
        },
      });
      const announced = { announcedAt: new Date(), announcementId: a.id };
      await tx.medalAward.updateMany({ where: { id: { in: announcedAwardIds } }, data: announced });
      await tx.rankPromotion.updateMany({ where: { id: { in: announcedPromotionIds } }, data: announced });
      return a;
    });
    await audit({
      action: 'announcement.published',
      req,
      targetType: 'announcement',
      targetId: announcement.id,
      metadata: { awards: announcedAwardIds.length, promotions: announcedPromotionIds.length, messages: sentIds.length },
    });
    if (failure) {
      // Envoi partiel : le reste demeure « à annoncer ».
      await discordFailure(failure, 'announce_partial', req);
    }
    res.status(failure ? 207 : 201).json({
      id: announcement.id,
      awardsCount: announcedAwardIds.length,
      promotionsCount: announcedPromotionIds.length,
      partial: Boolean(failure),
    });
  } finally {
    announcing = false;
  }
});

medalsAdminRouter.get('/announcements', async (_req, res) => {
  const list = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      createdBy: true,
      awards: { include: { user: true, medal: true } },
      promotions: { include: promotionInclude },
    },
  });
  res.json(
    list.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      createdBy: a.createdBy ? { id: a.createdBy.id, displayName: a.createdBy.displayName } : null,
      channelId: a.channelId,
      messagesCount: a.discordMessageIds.length,
      awardsCount: a.awardsCount,
      promotionsCount: a.promotionsCount,
      awards: a.awards.map((w) => ({ member: w.user.displayName, medal: w.medal.name, tier: w.tier, reason: w.reason })),
      promotions: a.promotions.map((p) => ({ member: p.user.displayName, from: p.fromRank?.name ?? null, to: p.toRank.name })),
    })),
  );
});
