import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { parse, toPage } from '../../lib/validate.js';

export const logsAdminRouter = Router();

// --- Notifications (actionnables) -----------------------------------------------------------

const NotifQuery = z.object({
  type: z.string().max(40).optional(),
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

logsAdminRouter.get('/notifications', async (req, res) => {
  const q = parse(NotifQuery, req.query);
  const where: Prisma.NotificationWhereInput = {
    ...(q.type ? { type: q.type } : {}),
    ...(q.unread === 'true' ? { readAt: null } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { readBy: { select: { displayName: true } } },
    }),
    prisma.notification.count({ where }),
  ]);
  res.json(
    toPage(
      items.map((n) => ({
        id: n.id,
        type: n.type,
        payload: n.payload,
        createdAt: n.createdAt,
        readAt: n.readAt,
        readBy: n.readBy?.displayName ?? null,
      })),
      total,
      q.page,
      q.pageSize,
    ),
  );
});

logsAdminRouter.get('/notifications/unread-count', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ count: await prisma.notification.count({ where: { readAt: null } }) });
});

logsAdminRouter.post('/notifications/:id/read', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const { count } = await prisma.notification.updateMany({
    where: { id, readAt: null },
    data: { readAt: new Date(), readById: req.user!.id },
  });
  if (!count && !(await prisma.notification.findUnique({ where: { id } }))) throw notFound();
  res.status(204).end();
});

logsAdminRouter.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { readAt: null }, data: { readAt: new Date(), readById: req.user!.id } });
  res.status(204).end();
});

// --- Journal d'audit (lecture seule) ---------------------------------------------------------

const LogQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  actor: z.string().max(40).optional(),
  action: z.string().max(60).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

function logWhere(q: z.infer<typeof LogQuery>): Prisma.AuditLogWhereInput {
  return {
    ...(q.from || q.to ? { createdAt: { gte: q.from, lte: q.to } } : {}),
    ...(q.actor ? { actorId: q.actor } : {}),
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.q
      ? {
          OR: [
            { action: { contains: q.q, mode: 'insensitive' } },
            { targetId: { contains: q.q } },
            { actor: { displayName: { contains: q.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}

const presentLog = (l: Prisma.AuditLogGetPayload<{ include: { actor: { select: { id: true; displayName: true } } } }>) => ({
  id: l.id,
  createdAt: l.createdAt,
  actor: l.actor ? { id: l.actor.id, displayName: l.actor.displayName } : l.actorHash ? { id: null, displayName: 'Compte supprimé' } : null,
  action: l.action,
  targetType: l.targetType,
  targetId: l.targetId,
  metadata: l.metadata,
});

logsAdminRouter.get('/logs', async (req, res) => {
  const q = parse(LogQuery, req.query);
  const where = logWhere(q);
  const [items, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { actor: { select: { id: true, displayName: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  res.json({ ...toPage(items.map(presentLog), total, q.page, q.pageSize), actions: actions.map((a) => a.action) });
});

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  // Neutralise l'injection de formules dans les tableurs.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

logsAdminRouter.get('/logs/export.csv', async (req, res) => {
  const q = parse(LogQuery, req.query);
  const items = await prisma.auditLog.findMany({
    where: logWhere(q),
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: { actor: { select: { id: true, displayName: true } } },
  });
  const rows = [
    ['date', 'acteur', 'action', 'type_cible', 'cible', 'details'].map(csvCell).join(';'),
    ...items.map(presentLog).map((l) =>
      [l.createdAt.toISOString(), l.actor?.displayName ?? 'système', l.action, l.targetType, l.targetId, l.metadata]
        .map(csvCell)
        .join(';'),
    ),
  ];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="journal-501e-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + rows.join('\r\n'));
});
