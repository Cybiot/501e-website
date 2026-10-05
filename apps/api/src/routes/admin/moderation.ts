import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { resolveModerationNotifications } from '../../lib/notify.js';
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
    await resolveModerationNotifications('image_submitted', { imageId: id }, { status: 'approved', by: req.user!.displayName }, tx);
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
    await resolveModerationNotifications('image_submitted', { imageId: id }, { status: 'rejected', by: req.user!.displayName, reason }, tx);
  });
  // Le fichier rejeté est supprimé par la tâche de rétention (30 jours par défaut).
  await audit({ action: 'image.rejected', req, targetType: 'user', targetId: img.userId, metadata: { imageId: id, reason } });
  res.status(204).end();
});

// --- Phrases personnalisées -----------------------------------------------------------------

export const TAGLINE_REJECTION_REASONS = [
  'Propos injurieux, haineux ou discriminatoires',
  'Contenu inapproprié ou choquant',
  'Référence ou symbole interdit',
  'Publicité ou spam',
  'Hors thème',
];

moderationAdminRouter.get('/moderation/taglines', async (_req, res) => {
  const profiles = await prisma.profile.findMany({
    where: { pendingTagline: { not: null } },
    orderBy: { pendingTaglineAt: 'asc' },
    include: { user: { include: { rank: true } } },
  });
  res.json({
    reasons: TAGLINE_REJECTION_REASONS,
    items: profiles.map((p) => ({
      userId: p.userId,
      text: p.pendingTagline!,
      submittedAt: p.pendingTaglineAt,
      currentText: p.tagline,
      member: {
        id: p.user.id,
        displayName: p.user.displayName,
        rank: presentRank(p.user.rank),
        discordAvatarUrl: p.user.discordAvatarUrl,
      },
    })),
  });
});

/**
 * Le texte modéré est renvoyé par l'admin : si le membre a modifié sa proposition entre-temps,
 * la décision est refusée plutôt que d'approuver un texte que l'admin n'a pas lu.
 */
const TaglineDecision = z.object({ text: z.string().min(1).max(140) });

async function loadPendingTagline(userId: string, text: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.pendingTagline) throw conflict('Cette phrase a déjà été traitée.', 'ALREADY_REVIEWED');
  if (profile.pendingTagline !== text) {
    throw conflict('Le membre a modifié sa phrase entre-temps. Recharge la file.', 'TAGLINE_CHANGED');
  }
  return profile;
}

moderationAdminRouter.post('/moderation/taglines/:userId/approve', async (req, res) => {
  const userId = parse(z.string().min(1).max(40), req.params.userId);
  const { text } = parse(TaglineDecision, req.body);
  await loadPendingTagline(userId, text);
  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.profile.updateMany({
      where: { userId, pendingTagline: text },
      data: {
        tagline: text,
        pendingTagline: null,
        pendingTaglineAt: null,
        taglineRejectionReason: null,
        taglineReviewedAt: new Date(),
      },
    });
    if (count) {
      await resolveModerationNotifications('tagline_submitted', { userId, text }, { status: 'approved', by: req.user!.displayName }, tx);
    }
    return count;
  });
  if (!count) throw conflict('Le membre a modifié sa phrase entre-temps. Recharge la file.', 'TAGLINE_CHANGED');
  await audit({ action: 'tagline.approved', req, targetType: 'user', targetId: userId, metadata: { text } });
  res.status(204).end();
});

/** Rejet : la phrase actuelle (déjà validée) reste affichée, le membre voit le motif. */
moderationAdminRouter.post('/moderation/taglines/:userId/reject', async (req, res) => {
  const userId = parse(z.string().min(1).max(40), req.params.userId);
  const { text, reason } = parse(
    TaglineDecision.extend({ reason: z.string().trim().min(3, 'Le motif est obligatoire.').max(300) }),
    req.body,
  );
  await loadPendingTagline(userId, text);
  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.profile.updateMany({
      where: { userId, pendingTagline: text },
      data: { pendingTagline: null, pendingTaglineAt: null, taglineRejectionReason: reason, taglineReviewedAt: new Date() },
    });
    if (count) {
      await resolveModerationNotifications(
        'tagline_submitted',
        { userId, text },
        { status: 'rejected', by: req.user!.displayName, reason },
        tx,
      );
    }
    return count;
  });
  if (!count) throw conflict('Le membre a modifié sa phrase entre-temps. Recharge la file.', 'TAGLINE_CHANGED');
  await audit({ action: 'tagline.rejected', req, targetType: 'user', targetId: userId, metadata: { text, reason } });
  res.status(204).end();
});
