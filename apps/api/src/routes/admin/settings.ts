import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { syncAllMembers } from '../../auth/sync.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { discord } from '../../discord/index.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { getSettings, SettingsSchema, updateSettings } from '../../lib/settings.js';
import { parse } from '../../lib/validate.js';

export const settingsAdminRouter = Router();

settingsAdminRouter.get('/settings', async (_req, res) => {
  const [settings, ranks, responsibilities] = await Promise.all([
    getSettings(),
    prisma.rank.findMany({ orderBy: { order: 'desc' }, include: { _count: { select: { users: true } } } }),
    prisma.responsibility.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], include: { _count: { select: { users: true } } } }),
  ]);
  res.json({
    discordMode: config.DISCORD_MODE,
    guildId: config.DISCORD_GUILD_ID || null,
    settings,
    ranks: ranks.map(({ _count, ...r }) => ({ ...r, usersCount: _count.users })),
    responsibilities: responsibilities.map(({ _count, ...r }) => ({ ...r, usersCount: _count.users })),
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
  .transform((v) => (v ? v : null));

const RankBody = z.object({
  name: z.string().trim().min(2).max(60),
  abbreviation: z.string().trim().min(1).max(12),
  order: z.number().int().min(0).max(999),
  discordRoleId: nullableRole,
});

const ResponsibilityBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(''),
  order: z.number().int().min(0).max(999).default(0),
  discordRoleId: nullableRole,
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
  await audit({ action: 'settings.updated', req, targetType: 'rank', targetId: rank.id, metadata: { created: body } });
  res.status(201).json(rank);
});

settingsAdminRouter.patch('/ranks/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const body = parse(RankBody.partial(), req.body);
  const rank = await prisma.rank.update({ where: { id }, data: body }).catch(uniqueGuard);
  await audit({ action: 'settings.updated', req, targetType: 'rank', targetId: id, metadata: { updated: body } });
  res.json(rank);
});

settingsAdminRouter.delete('/ranks/:id', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  await prisma.rank.delete({ where: { id } }).catch(uniqueGuard);
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
  const body = parse(ResponsibilityBody.partial(), req.body);
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
