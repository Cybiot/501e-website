import { Router } from 'express';
import { requireAdmin } from '../../auth/guards.js';
import { prisma } from '../../db.js';
import { medalsAdminRouter } from './medals.js';
import { moderationAdminRouter } from './moderation.js';
import { logsAdminRouter } from './logs.js';
import { ranksAdminRouter } from './ranks.js';
import { settingsAdminRouter } from './settings.js';

/** Toutes les routes /api/admin/** sont protégées côté serveur (statut Admin revérifié). */
export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

adminRouter.get('/dashboard', async (_req, res) => {
  const [members, admins, hiddenProfiles, pendingImages, pendingTaglines, unreadNotifications, pendingAwards, pendingPromotions, locations, recentLogs] =
    await Promise.all([
      prisma.user.count({ where: { status: { in: ['member', 'admin'] }, deletedAt: null } }),
      prisma.user.count({ where: { status: 'admin', deletedAt: null } }),
      prisma.user.count({ where: { status: { in: ['member', 'admin'] }, publicProfileEnabled: false } }),
      prisma.customImage.count({ where: { status: 'pending' } }),
      prisma.profile.count({ where: { pendingTagline: { not: null } } }),
      prisma.notification.count({ where: { readAt: null } }),
      prisma.medalAward.count({ where: { announcedAt: null, revokedAt: null } }),
      prisma.rankPromotion.count({ where: { announcedAt: null, user: { status: { in: ['member', 'admin'] }, deletedAt: null } } }),
      prisma.memberLocation.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { displayName: true } } },
      }),
    ]);
  res.json({
    counts: { members, admins, hiddenProfiles, pendingImages, pendingTaglines, unreadNotifications, pendingAwards, pendingPromotions, locations },
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      action: l.action,
      actor: l.actor?.displayName ?? null,
    })),
  });
});

adminRouter.use(medalsAdminRouter);
adminRouter.use(moderationAdminRouter);
adminRouter.use(ranksAdminRouter);
adminRouter.use(logsAdminRouter);
adminRouter.use(settingsAdminRouter);
