import { Router } from 'express';
import { z } from 'zod';
import { isMemberStatus } from '../auth/guards.js';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { readStoredFile } from '../lib/storage.js';
import { parse } from '../lib/validate.js';

export const filesRouter = Router();

const Params = z.object({
  dir: z.enum(['avatars', 'medals']),
  name: z.string().regex(/^[A-Za-z0-9_-]+\.(webp|png)$/),
});

/**
 * Accès sécurisé aux fichiers stockés localement :
 * - médailles : publiques ;
 * - images approuvées : visibles selon la visibilité du profil ;
 * - images en attente/rejetées : propriétaire et admins uniquement.
 */
filesRouter.get('/:dir/:name', async (req, res) => {
  const { dir, name } = parse(Params, req.params);
  const key = `${dir}/${name}`;
  const viewer = req.user;
  const viewerIsMember = isMemberStatus(viewer?.status);

  if (dir === 'avatars') {
    const img = await prisma.customImage.findUnique({ where: { storageKey: key }, include: { user: true } });
    if (!img) throw notFound();
    const isOwner = viewer?.id === img.userId;
    const isAdmin = viewer?.status === 'admin';
    if (img.status === 'approved') {
      const ownerVisible = isMemberStatus(img.user.status) && !img.user.deletedAt;
      const allowed = isOwner || isAdmin || (ownerVisible && (img.user.publicProfileEnabled || viewerIsMember));
      if (!allowed) throw notFound();
      res.set('Cache-Control', img.user.publicProfileEnabled ? 'public, max-age=3600' : 'private, max-age=3600');
    } else {
      if (!isOwner && !isAdmin) throw notFound();
      res.set('Cache-Control', 'private, no-store');
    }
  } else {
    res.set('Cache-Control', 'public, max-age=86400');
  }

  let data: Buffer;
  try {
    data = await readStoredFile(key);
  } catch {
    throw notFound();
  }
  res.type(name.endsWith('.png') ? 'image/png' : 'image/webp');
  res.set('X-Content-Type-Options', 'nosniff');
  res.send(data);
});
