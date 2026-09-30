import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { presentRank } from '../../lib/presenters.js';
import { deleteFile, fileUrl } from '../../lib/storage.js';
import { parse } from '../../lib/validate.js';

export const moderationAdminRouter = Router();

/** Motifs de rejet prédéfinis (le champ reste libre). */
export const REJECTION_REASONS = [
  'Image hors thème (doit évoquer le personnage ou la 501e)',
  'Contenu inapproprié ou choquant',
  'Symbole ou contenu interdit',
  'Qualité insuffisante (floue, trop petite, mal cadrée)',
  'Image protégée par des droits d’auteur',
  'Visage reconnaissable d’un tiers',
];

moderationAdminRouter.get('/moderation', async (_req, res) => {
  const images = await prisma.customImage.findMany({
    where: { status: 'pending' },
    orderBy: { submittedAt: 'asc' },
    include: { user: { include: { rank: true, profile: { include: { customImage: true } } } } },
  });
  res.json({
    reasons: REJECTION_REASONS,
    items: images.map((i) => ({
      id: i.id,
      url: fileUrl(i.storageKey),
      submittedAt: i.submittedAt,
      member: {
        id: i.user.id,
        displayName: i.user.displayName,
        rank: presentRank(i.user.rank),
        discordAvatarUrl: i.user.discordAvatarUrl,
        currentImageUrl:
          i.user.profile?.customImage?.status === 'approved' ? fileUrl(i.user.profile.customImage.storageKey) : null,
      },
    })),
  });
});

async function loadPending(id: string) {
  const img = await prisma.customImage.findUnique({ where: { id }, include: { user: { include: { profile: true } } } });
  if (!img) throw notFound('Image introuvable.');
  if (img.status !== 'pending') throw conflict('Cette image a déjà été traitée.', 'ALREADY_REVIEWED');
  return img;
}

/** Approbation : la nouvelle image remplace l'ancienne (supprimée). */
moderationAdminRouter.post('/moderation/:id/approve', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const img = await loadPending(id);
  const previousId = img.user.profile?.customImageId;
  const previous = previousId ? await prisma.customImage.findUnique({ where: { id: previousId } }) : null;
  await prisma.$transaction(async (tx) => {
    await tx.customImage.update({
      where: { id },
      data: { status: 'approved', reviewedAt: new Date(), reviewedById: req.user!.id },
    });
    await tx.profile.upsert({
      where: { userId: img.userId },
      create: { userId: img.userId, customImageId: id },
      update: { customImageId: id, pendingImageId: null },
    });
    if (previous) await tx.customImage.delete({ where: { id: previous.id } });
  });
  if (previous) await deleteFile(previous.storageKey);
  await audit({ action: 'image.approved', req, targetType: 'user', targetId: img.userId, metadata: { imageId: id } });
  res.status(204).end();
});

moderationAdminRouter.post('/moderation/:id/reject', async (req, res) => {
  const id = parse(z.string().min(1), req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Le motif est obligatoire.').max(300) }), req.body);
  const img = await loadPending(id);
  await prisma.$transaction(async (tx) => {
    await tx.customImage.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: reason, reviewedAt: new Date(), reviewedById: req.user!.id },
    });
    await tx.profile.update({ where: { userId: img.userId }, data: { pendingImageId: null } });
  });
  // Le fichier rejeté est supprimé par la tâche de rétention (30 jours par défaut).
  await audit({ action: 'image.rejected', req, targetType: 'user', targetId: img.userId, metadata: { imageId: id, reason } });
  res.status(204).end();
});
