import { syncAllMembers } from '../auth/sync.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { deleteUserData } from '../lib/gdpr.js';
import { logger } from '../lib/logger.js';
import { refreshRankPrefixes } from '../lib/rank-prefix.js';
import { notifyAdmins } from '../lib/notify.js';
import { deleteFile } from '../lib/storage.js';

const DAY = 24 * 3600 * 1000;
const monthsAgo = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d;
};

/**
 * Purges RGPD (limitation de la conservation) :
 * - journal d'audit > 12 mois, notifications lues > 12 mois ;
 * - images rejetées > 30 jours ;
 * - anciens membres (rôle perdu) > 30 jours : compte supprimé ;
 * - connectés jamais membres, inactifs > 30 jours : compte supprimé ;
 * - comptes inactifs > 24 mois : notification à 23 mois puis suppression ;
 * - sessions expirées.
 */
export async function runRetention() {
  const now = Date.now();
  const logs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: monthsAgo(config.AUDIT_LOG_RETENTION_MONTHS) } },
  });
  const notifications = await prisma.notification.deleteMany({
    where: { readAt: { not: null }, createdAt: { lt: monthsAgo(config.AUDIT_LOG_RETENTION_MONTHS) } },
  });

  const rejected = await prisma.customImage.findMany({
    where: { status: 'rejected', reviewedAt: { lt: new Date(now - config.REJECTED_IMAGE_RETENTION_DAYS * DAY) } },
  });
  for (const img of rejected) {
    await prisma.customImage.delete({ where: { id: img.id } });
    await deleteFile(img.storageKey);
  }

  const departed = await prisma.user.findMany({
    where: {
      status: 'none',
      OR: [
        { leftAt: { lt: new Date(now - config.DEPARTED_MEMBER_RETENTION_DAYS * DAY) } },
        { leftAt: null, lastLoginAt: { lt: new Date(now - config.DEPARTED_MEMBER_RETENTION_DAYS * DAY) } },
      ],
    },
    select: { id: true },
  });
  for (const u of departed) await deleteUserData(u.id, 'retention');

  const inactiveLimit = monthsAgo(config.INACTIVE_ACCOUNT_MONTHS);
  const warnLimit = monthsAgo(config.INACTIVE_ACCOUNT_MONTHS - 1);
  const toWarn = await prisma.user.findMany({
    where: { lastLoginAt: { lt: warnLimit, gte: inactiveLimit }, inactivityNotifiedAt: null },
  });
  for (const u of toWarn) {
    await notifyAdmins('inactive_account', { userId: u.id, displayName: u.displayName, lastLoginAt: u.lastLoginAt?.toISOString() ?? null });
    await prisma.user.update({ where: { id: u.id }, data: { inactivityNotifiedAt: new Date() } });
  }
  const inactive = await prisma.user.findMany({
    where: { lastLoginAt: { lt: inactiveLimit }, inactivityNotifiedAt: { not: null } },
    select: { id: true },
  });
  for (const u of inactive) await deleteUserData(u.id, 'retention');

  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const summary = {
    auditLogs: logs.count,
    notifications: notifications.count,
    rejectedImages: rejected.length,
    departedAccounts: departed.length,
    inactiveWarned: toWarn.length,
    inactiveDeleted: inactive.length,
    sessions: sessions.count,
  };
  if (Object.values(summary).some((n) => n > 0)) {
    await audit({ action: 'retention.purge', actorId: null, metadata: summary });
  }
  logger.info(summary, 'Purge RGPD effectuée');
  return summary;
}

export function startJobs() {
  const timers: NodeJS.Timeout[] = [];
  const safe = (name: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
    } catch (err) {
      logger.error({ err: (err as Error).message, job: name }, 'Tâche planifiée en échec');
    }
  };

  if (config.ROLE_SYNC_INTERVAL_MINUTES > 0) {
    const sync = safe('role-sync', async () => {
      const r = await syncAllMembers();
      logger.info(r, 'Synchronisation des rôles Discord');
    });
    timers.push(setInterval(sync, config.ROLE_SYNC_INTERVAL_MINUTES * 60 * 1000));
    timers.push(setTimeout(sync, 30_000));
  }
  // Grades modifiés hors de l'API (seed, SQL direct) : abréviations rechargées régulièrement.
  timers.push(setInterval(safe('rank-prefixes', refreshRankPrefixes), 5 * 60 * 1000));

  const retention = safe('retention', runRetention);
  timers.push(setInterval(retention, DAY));
  timers.push(setTimeout(retention, 60_000));

  return () => timers.forEach((t) => clearInterval(t));
}
