import { Router } from 'express';
import { requireMember } from '../auth/guards.js';
import { prisma } from '../db.js';
import { avatarOf, presentRank } from '../lib/presenters.js';

export const mapRouter = Router();

/** Carte des membres : réservée aux membres connectés (401/403 sinon). */
mapRouter.get('/members', requireMember(), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: { in: ['member', 'admin'] }, deletedAt: null, locations: { some: {} } },
    include: {
      rank: true,
      profile: { include: { customImage: true } },
      responsibilities: true,
      locations: true,
    },
  });
  res.set('Cache-Control', 'private, no-store');
  res.json(
    users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      avatarUrl: avatarOf(u),
      rank: presentRank(u.rank),
      tagline: u.profile?.tagline ?? null,
      responsibilityIds: u.responsibilities.map((r) => r.responsibilityId),
      locations: u.locations.map((l) => ({
        id: l.id,
        cityLabel: l.cityLabel,
        country: l.country,
        lat: l.lat,
        lng: l.lng,
      })),
    })),
  );
});
