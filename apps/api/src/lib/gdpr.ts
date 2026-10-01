import { prisma } from '../db.js';
import { audit } from './audit.js';
import { saltedHash } from './crypto.js';
import { logger } from './logger.js';
import { deleteFile, fileUrl } from './storage.js';

/**
 * Droit d'accès / portabilité : toutes les données détenues sur le membre, en JSON.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      rank: true,
      profile: true,
      responsibilities: { include: { responsibility: true } },
      images: true,
      awards: { include: { medal: true } },
      locations: true,
      consents: { orderBy: { createdAt: 'asc' } },
      sessions: { select: { createdAt: true, expiresAt: true, lastSeenAt: true } },
    },
  });
  const logs = await prisma.auditLog.findMany({
    where: { actorId: userId },
    orderBy: { createdAt: 'desc' },
    select: { action: true, targetType: true, createdAt: true },
  });
  return {
    exportedAt: new Date().toISOString(),
    notice:
      "Export de tes données personnelles détenues par le site de la 501e (RGPD, art. 15 et 20). Les rôles Discord sont gérés par Discord.",
    identity: {
      discordId: user.discordId,
      displayName: user.displayName,
      discordAvatarUrl: user.discordAvatarUrl,
      status: user.status,
      discordRoleIds: user.discordRoleIds,
      joinedAt: user.joinedAt,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    rank: user.rank?.name ?? null,
    responsibilities: user.responsibilities.map((r) => r.responsibility.name),
    profile: {
      tagline: user.profile?.tagline ?? null,
      publicProfileEnabled: user.publicProfileEnabled,
    },
    consents: {
      current: {
        version: user.consentVersion,
        acceptedAt: user.consentAcceptedAt,
        publicProfile: user.publicProfileEnabled,
        customImage: user.consentCustomImage,
        location: user.consentLocation,
      },
      history: user.consents.map(({ version, publicProfile, customImage, location, createdAt }) => ({
        version,
        publicProfile,
        customImage,
        location,
        createdAt,
      })),
    },
    images: user.images.map((i) => ({
      status: i.status,
      url: fileUrl(i.storageKey),
      submittedAt: i.submittedAt,
      reviewedAt: i.reviewedAt,
      rejectionReason: i.rejectionReason,
    })),
    medals: user.awards.map((a) => ({
      medal: a.medal.name,
      tier: a.tier,
      reason: a.reason,
      awardedAt: a.awardedAt,
      revokedAt: a.revokedAt,
    })),
    locations: user.locations.map(({ cityLabel, country, lat, lng, createdAt }) => ({
      cityLabel,
      country,
      lat,
      lng,
      createdAt,
    })),
    sessions: user.sessions,
    activityLog: logs,
  };
}

/**
 * Droit à l'effacement : supprime le compte, les images, les villes, les médailles (côté site)
 * et anonymise le journal d'audit (identifiant remplacé par une empreinte).
 */
export async function deleteUserData(userId: string, reason: 'user_request' | 'retention') {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { images: true } });
  if (!user) return;
  const actorHash = saltedHash(`user:${user.id}`);

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorId: null, actorHash } });
    await tx.auditLog.updateMany({
      where: { targetType: 'user', targetId: userId },
      data: { targetId: actorHash },
    });
    // Les notifications qui citent l'utilisateur sont supprimées (données personnelles dans le payload).
    await tx.notification.deleteMany({ where: { payload: { path: ['userId'], equals: userId } } });
    await tx.user.delete({ where: { id: userId } }); // cascade : profil, images, villes, médailles, sessions…
  });

  for (const img of user.images) {
    await deleteFile(img.storageKey).catch((err) =>
      logger.error({ err: (err as Error).message }, 'Suppression de fichier impossible'),
    );
  }
  await audit({
    action: reason === 'user_request' ? 'gdpr.delete' : 'retention.purge',
    actorId: null,
    targetType: 'user',
    targetId: actorHash,
    metadata: { reason },
  });
}
