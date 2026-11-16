import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { parse } from '../../lib/validate.js';

export const locationsAdminRouter = Router();

/**
 * Retrait d'une ville jugée problématique : la ville quitte la carte et le membre voit le motif
 * dans son profil. Il reste libre d'ajouter une autre ville.
 */
locationsAdminRouter.delete('/locations/:id', async (req, res) => {
  const id = parse(z.string().min(1).max(40), req.params.id);
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Le motif est obligatoire.').max(300) }), req.body);
  const location = await prisma.$transaction(async (tx) => {
    const location = await tx.memberLocation.findUnique({ where: { id } });
    if (!location) return null;
    await tx.memberLocation.delete({ where: { id } });
    const removal = { locationRemovedCity: location.cityLabel, locationRemovalReason: reason, locationRemovedAt: new Date() };
    await tx.profile.upsert({ where: { userId: location.userId }, create: { userId: location.userId, ...removal }, update: removal });
    return location;
  });
  if (!location) throw notFound('Ville introuvable (déjà supprimée ?).');
  await audit({
    action: 'location.removed',
    req,
    targetType: 'user',
    targetId: location.userId,
    metadata: { cityLabel: location.cityLabel, country: location.country, reason },
  });
  res.status(204).end();
});
