import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { syncAllMembers } from '../../auth/sync.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { discord } from '../../discord/index.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { refreshRankPrefixes } from '../../lib/rank-prefix.js';
import { getSettings, SettingsSchema, updateSettings } from '../../lib/settings.js';
import { parse } from '../../lib/validate.js';

export const settingsAdminRouter = Router();

settingsAdminRouter.get('/settings', async (_req, res) => {
  const [settings, ranks, responsibilities, companies] = await Promise.all([
    getSettings(),
    prisma.rank.findMany({ orderBy: { order: 'desc' }, include: { _count: { select: { users: true } } } }),
    prisma.responsibility.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], include: { _count: { select: { users: true } } } }),
    prisma.company.findMany({ orderBy: { order: 'asc' }, include: { platoons: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } } }),
  ]);
  res.json({
    discordMode: config.DISCORD_MODE,
    guildId: config.DISCORD_GUILD_ID || null,
    settings,
    ranks: ranks.map(({ _count, ...r }) => ({ ...r, usersCount: _count.users })),
    responsibilities: responsibilities.map(({ _count, ...r }) => ({ ...r, usersCount: _count.users })),
    companies,
  });
});

settingsAdminRouter.put('/settings', async (req, res) => {
  const patch = parse(SettingsSchema.partial(), req.body);
  const before = await getSettings();
  const after = await updateSettings(patch);
  const changed = Object.keys(patch).filter(
    (k) => JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(after[k as keyof typeof after]),
  );
  await audit({ action: 'settings.updated', req, targetType: 'settings', metadata: { changed } });
  res.json(after);
});

settingsAdminRouter.post('/settings/check-integration', async (_req, res) => {
  const settings = await getSettings();
  const result = await discord().checkIntegration();
  const checks = [
    ...result.checks,
    { label: 'Rôle(s) Membre configuré(s)', ok: settings.memberRoleIds.length > 0 },
    { label: 'Rôle(s) Admin configuré(s)', ok: settings.adminRoleIds.length > 0 },
    { label: "Salon d'annonce configuré", ok: Boolean(settings.announceChannelId) },
    { label: "Lien d'invitation configuré", ok: Boolean(settings.inviteUrl) },
  ];
  res.json({ ok: checks.every((c) => c.ok), checks });
});

/** Resynchronisation manuelle de tous les rôles (en plus du job périodique). */
settingsAdminRouter.post('/settings/sync-roles', async (req, res) => {
  const result = await syncAllMembers();
  await audit({ action: 'settings.updated', req, metadata: { manualRoleSync: result } });
  res.json(result);
});

// --- Grades et responsabilités (correspondance avec les rôles Discord) -----------------------

const nullableRole = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional()
  // Absent (PATCH partiel) : on ne touche pas au rôle ; vide : on le retire.
  .transform((v) => (v === undefined ? undefined : v || null));

const RankBody = z.object({
  name: z.string().trim().min(2).max(60),
  abbreviation: z.string().trim().min(1).max(12),
  branch: z.enum(['toccoa', 'enlisted', 'platoon_leader', 'xo', 'co', 'staff']),
  order: z.number().int().min(0).max(999),
  discordRoleId: nullableRole,
});

// Sans valeurs par défaut : en Zod 4, un .default() s'applique même sous .partial(),
// ce qui écraserait les champs absents d'un PATCH.
const ResponsibilityPatch = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300),
  kind: z.enum(['hierarchy', 'pole']),
  order: z.number().int().min(0).max(999),
  discordRoleId: nullableRole,
});
const ResponsibilityBody = ResponsibilityPatch.extend({
  description: ResponsibilityPatch.shape.description.default(''),
  kind: ResponsibilityPatch.shape.kind.default('pole'),
  order: ResponsibilityPatch.shape.order.default(0),
});

const uniqueGuard = (err: unknown): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw conflict('Nom, ordre ou rôle Discord déjà utilisé.', 'DUPLICATE');
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw notFound();
  throw err;
};

settingsAdminRouter.post('/ranks', async (req, res) => {
  const body = parse(RankBody, req.body);
  const rank = await prisma.rank.create({ data: body }).catch(uniqueGuard);
  await refreshRankPrefixes();
  await audit({ action: 'settings.updated', req, targetType: 'rank', targetId: rank.id, metadata: { created: body } });
  res.status(201).json(rank);
});

settingsAdminRouter.patch('/ranks/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const body = parse(RankBody.partial(), req.body);
  const rank = await prisma.rank.update({ where: { id }, data: body }).catch(uniqueGuard);
  await refreshRankPrefixes();
  await audit({ action: 'settings.updated', req, targetType: 'rank', targetId: id, metadata: { updated: body } });
  res.json(rank);
});

settingsAdminRouter.delete('/ranks/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  await prisma.rank.delete({ where: { id } }).catch(uniqueGuard);
  await refreshRankPrefixes();
  await audit({ action: 'settings.updated', req, targetType: 'rank', targetId: id, metadata: { deleted: true } });
  res.status(204).end();
});

settingsAdminRouter.post('/responsibilities', async (req, res) => {
  const body = parse(ResponsibilityBody, req.body);
  const r = await prisma.responsibility.create({ data: body }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'responsibility', targetId: r.id, metadata: { created: body } });
  res.status(201).json(r);
});

settingsAdminRouter.patch('/responsibilities/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const body = parse(ResponsibilityPatch.partial(), req.body);
  const r = await prisma.responsibility.update({ where: { id }, data: body }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'responsibility', targetId: id, metadata: { updated: body } });
  res.json(r);
});

settingsAdminRouter.delete('/responsibilities/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  await prisma.responsibility.delete({ where: { id } }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'responsibility', targetId: id, metadata: { deleted: true } });
  res.status(204).end();
});

// --- Compagnies et platoons (appartenance par rôle Discord) ----------------------------------
// Les compagnies sont fixes (textes et logos dans le contenu du site) : seul leur rôle se modifie.

settingsAdminRouter.patch('/companies/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const body = parse(z.object({ discordRoleId: nullableRole }), req.body);
  const c = await prisma.company.update({ where: { id }, data: body }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'company', targetId: id, metadata: { updated: body } });
  res.json(c);
});

const PlatoonBody = z.object({
  name: z.string().trim().min(2).max(60),
  order: z.number().int().min(0).max(999),
  discordRoleId: nullableRole,
});

settingsAdminRouter.post('/companies/:id/platoons', async (req, res) => {
  const companyId = parse(z.string().min(1), req.params.id);
  const body = parse(PlatoonBody, req.body);
  const p = await prisma.platoon.create({ data: { ...body, companyId } }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'platoon', targetId: p.id, metadata: { created: { ...body, companyId } } });
  res.status(201).json(p);
});

settingsAdminRouter.patch('/platoons/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const body = parse(PlatoonBody.partial(), req.body);
  const p = await prisma.platoon.update({ where: { id }, data: body }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'platoon', targetId: id, metadata: { updated: body } });
  res.json(p);
});

settingsAdminRouter.delete('/platoons/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  await prisma.platoon.delete({ where: { id } }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'platoon', targetId: id, metadata: { deleted: true } });
  res.status(204).end();
});
