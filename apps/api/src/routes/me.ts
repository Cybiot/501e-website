import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireMember } from '../auth/guards.js';
import { destroySession } from '../auth/session.js';
import { prisma } from '../db.js';
import { searchCities } from '../geocoding/index.js';
import { audit } from '../lib/audit.js';
import { deterministicUnit } from '../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { deleteUserData, exportUserData } from '../lib/gdpr.js';
import { notifyAdmins } from '../lib/notify.js';
import { avatarOf, loadCompanyIndex, memberInclude, presentMemberDetail } from '../lib/presenters.js';
import { getSettings } from '../lib/settings.js';
import { deleteFile, fileUrl, storeProfileImage } from '../lib/storage.js';
import { parse } from '../lib/validate.js';

export const meRouter = Router();

export const MAX_LOCATIONS = 2;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Liens et invitations : interdits dans la phrase personnalisée (anti-spam). */
const LINK_PATTERN = /(https?:\/\/|www\.|discord\.gg|discord(app)?\.com\/invite)/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

// --- Consentement (accessible sans consentement à jour, évidemment) --------------------------

const ConsentBody = z.object({
  publicProfile: z.boolean(),
  customImage: z.boolean(),
  location: z.boolean(),
});

meRouter.post('/consent', requireMember({ allowWithoutConsent: true }), async (req, res) => {
  const body = parse(ConsentBody, req.body);
  const { consentVersion } = await getSettings();
  const userId = req.user!.id;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        consentAcceptedAt: new Date(),
        consentVersion,
        publicProfileEnabled: body.publicProfile,
        consentCustomImage: body.customImage,
        consentLocation: body.location,
      },
    });
    await tx.consentRecord.create({ data: { userId, version: consentVersion, ...body } });
    await tx.profile.upsert({ where: { userId }, create: { userId }, update: {} });
  });
  await applyConsentWithdrawals(userId, body);
  await audit({ action: 'consent.accepted', req, metadata: { version: consentVersion, ...body } });
  res.status(204).end();
});

/** Retrait d'un consentement = effet immédiat (suppression des données concernées). */
async function applyConsentWithdrawals(userId: string, c: { customImage: boolean; location: boolean }) {
  if (!c.location) await prisma.memberLocation.deleteMany({ where: { userId } });
  if (!c.customImage) {
    const images = await prisma.customImage.findMany({ where: { userId } });
    await prisma.customImage.deleteMany({ where: { userId } });
    await Promise.all(images.map((i) => deleteFile(i.storageKey)));
  }
}

meRouter.use(requireMember());

// --- Profil ---------------------------------------------------------------------------------

meRouter.get('/profile', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: {
      ...memberInclude,
      profile: { include: { customImage: true, pendingImage: true } },
      locations: { orderBy: { createdAt: 'asc' } },
      consents: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  const lastRejected = await prisma.customImage.findFirst({
    where: { userId: user.id, status: 'rejected' },
    orderBy: { reviewedAt: 'desc' },
  });
  const approved = user.profile?.customImage;
  const showRejection =
    lastRejected && (!approved?.reviewedAt || (lastRejected.reviewedAt ?? 0) > approved.reviewedAt) && !user.profile?.pendingImage;
  res.json({
    ...presentMemberDetail(user, await loadCompanyIndex()),
    discordAvatarUrl: user.discordAvatarUrl,
    avatarUrl: avatarOf(user),
    publicProfileEnabled: user.publicProfileEnabled,
    consents: {
      version: user.consentVersion,
      acceptedAt: user.consentAcceptedAt,
      customImage: user.consentCustomImage,
      location: user.consentLocation,
      history: user.consents.map((c) => ({
        version: c.version,
        publicProfile: c.publicProfile,
        customImage: c.customImage,
        location: c.location,
        createdAt: c.createdAt,
      })),
    },
    image: {
      approvedUrl: approved?.status === 'approved' ? fileUrl(approved.storageKey) : null,
      pending: user.profile?.pendingImage
        ? { url: fileUrl(user.profile.pendingImage.storageKey), submittedAt: user.profile.pendingImage.submittedAt }
        : null,
      rejected: showRejection
        ? { reason: lastRejected.rejectionReason, reviewedAt: lastRejected.reviewedAt }
        : null,
    },
    locations: user.locations.map((l) => ({ id: l.id, cityLabel: l.cityLabel, country: l.country })),
    // Formations : module V2 (non livré en V1).
  });
});

const ProfilePatch = z
  .object({
    tagline: z.string().trim().max(140, '140 caractères maximum.').nullable().optional(),
    publicProfileEnabled: z.boolean().optional(),
    consentCustomImage: z.boolean().optional(),
    consentLocation: z.boolean().optional(),
  })
  .strict();

meRouter.patch('/profile', async (req, res) => {
  const body = parse(ProfilePatch, req.body);
  const userId = req.user!.id;
  if (body.tagline) {
    // Retire les caractères de contrôle et les retours à la ligne.
    body.tagline = body.tagline.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (LINK_PATTERN.test(body.tagline)) throw badRequest('Les liens ne sont pas autorisés dans la phrase.');
  }
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const consentChanged =
    (body.publicProfileEnabled !== undefined && body.publicProfileEnabled !== before.publicProfileEnabled) ||
    (body.consentCustomImage !== undefined && body.consentCustomImage !== before.consentCustomImage) ||
    (body.consentLocation !== undefined && body.consentLocation !== before.consentLocation);

  const after = await prisma.$transaction(async (tx) => {
    if (body.tagline !== undefined) {
      await tx.profile.upsert({
        where: { userId },
        create: { userId, tagline: body.tagline || null },
        update: { tagline: body.tagline || null },
      });
    }
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        publicProfileEnabled: body.publicProfileEnabled,
        consentCustomImage: body.consentCustomImage,
        consentLocation: body.consentLocation,
      },
    });
    if (consentChanged) {
      await tx.consentRecord.create({
        data: {
          userId,
          version: u.consentVersion ?? 'inconnue',
          publicProfile: u.publicProfileEnabled,
          customImage: u.consentCustomImage,
          location: u.consentLocation,
        },
      });
    }
    return u;
  });
  if (consentChanged) {
    await applyConsentWithdrawals(userId, { customImage: after.consentCustomImage, location: after.consentLocation });
  }
  if (body.publicProfileEnabled !== undefined && body.publicProfileEnabled !== before.publicProfileEnabled) {
    await audit({ action: 'profile.visibility_changed', req, metadata: { public: body.publicProfileEnabled } });
  }
  await audit({ action: 'profile.updated', req, metadata: { fields: Object.keys(body) } });
  res.status(204).end();
});

// --- Image personnalisée --------------------------------------------------------------------

const imageLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

meRouter.post('/image', imageLimiter, upload.single('image'), async (req, res) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
  if (!user.consentCustomImage) {
    throw forbidden("Active d'abord l'option « Image personnalisée » dans tes consentements.", 'CONSENT_IMAGE_REQUIRED');
  }
  if (!req.file) throw badRequest('Aucun fichier reçu.');
  const key = await storeProfileImage(req.file.buffer);
  const previousPending = user.profile?.pendingImageId
    ? await prisma.customImage.findUnique({ where: { id: user.profile.pendingImageId } })
    : null;
  const image = await prisma.$transaction(async (tx) => {
    const img = await tx.customImage.create({ data: { userId, storageKey: key } });
    await tx.profile.upsert({
      where: { userId },
      create: { userId, pendingImageId: img.id },
      update: { pendingImageId: img.id },
    });
    // Une seule image en attente par membre : la précédente est remplacée.
    if (previousPending) await tx.customImage.delete({ where: { id: previousPending.id } });
    return img;
  });
  if (previousPending) await deleteFile(previousPending.storageKey);
  await notifyAdmins('image_submitted', { userId, displayName: user.displayName, imageId: image.id });
  await audit({ action: 'image.submitted', req, targetType: 'image', targetId: image.id });
  res.status(201).json({ id: image.id, status: image.status, url: fileUrl(key) });
});

/** Retire l'image approuvée et/ou en attente (retour à l'avatar Discord). */
meRouter.delete('/image', async (req, res) => {
  const userId = req.user!.id;
  const images = await prisma.customImage.findMany({ where: { userId, status: { in: ['approved', 'pending'] } } });
  await prisma.customImage.deleteMany({ where: { id: { in: images.map((i) => i.id) } } });
  await Promise.all(images.map((i) => deleteFile(i.storageKey)));
  res.status(204).end();
});

// --- Villes (carte des membres) --------------------------------------------------------------

const geocodeLimiter = rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false });

meRouter.get('/geocode', geocodeLimiter, async (req, res) => {
  const q = parse(z.string().trim().min(2).max(80), req.query.q);
  res.json(await searchCities(q));
});

meRouter.get('/locations', async (req, res) => {
  const locations = await prisma.memberLocation.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(locations.map((l) => ({ id: l.id, cityLabel: l.cityLabel, country: l.country, lat: l.lat, lng: l.lng })));
});

const LocationBody = z.object({
  cityLabel: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Case de consentement cochée dans le panneau « Mes villes ». */
  consent: z.boolean().optional(),
});

/**
 * Précision « ville » uniquement : arrondi à 2 décimales (~1 km) puis décalage déterministe
 * de ±0,02° maximum, pour qu'aucune position fine ne soit stockée ni déductible.
 */
export function blurCoordinates(userId: string, label: string, lat: number, lng: number) {
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    lat: round(round(lat, 2) + deterministicUnit(`${userId}|${label}|lat`) * 0.02, 3),
    lng: round(round(lng, 2) + deterministicUnit(`${userId}|${label}|lng`) * 0.02, 3),
  };
}

meRouter.post('/locations', async (req, res) => {
  const body = parse(LocationBody, req.body);
  const userId = req.user!.id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.consentLocation && !body.consent) {
    throw forbidden('Consentement requis pour afficher ta ville sur la carte.', 'CONSENT_LOCATION_REQUIRED');
  }
  const coords = blurCoordinates(userId, body.cityLabel, body.lat, body.lng);
  const created = await prisma.$transaction(async (tx) => {
    // Verrou par utilisateur : deux ajouts simultanés ne peuvent pas dépasser le quota.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const count = await tx.memberLocation.count({ where: { userId } });
    if (count >= MAX_LOCATIONS) {
      throw conflict(`Tu as déjà ${MAX_LOCATIONS} villes. Supprime-en une pour en ajouter une autre.`, 'LOCATION_LIMIT');
    }
    if (!user.consentLocation) {
      await tx.user.update({ where: { id: userId }, data: { consentLocation: true } });
      await tx.consentRecord.create({
        data: {
          userId,
          version: user.consentVersion ?? 'inconnue',
          publicProfile: user.publicProfileEnabled,
          customImage: user.consentCustomImage,
          location: true,
        },
      });
    }
    return tx.memberLocation.create({
      data: { userId, cityLabel: body.cityLabel, country: body.country, ...coords },
    });
  });
  await audit({ action: 'location.added', req, targetType: 'location', targetId: created.id });
  res.status(201).json({ id: created.id, cityLabel: created.cityLabel, country: created.country, lat: created.lat, lng: created.lng });
});

meRouter.delete('/locations/:id', async (req, res) => {
  const id = parse(z.string().min(1).max(40), req.params.id);
  const { count } = await prisma.memberLocation.deleteMany({ where: { id, userId: req.user!.id } });
  if (!count) throw notFound('Ville introuvable.');
  await audit({ action: 'location.deleted', req, targetType: 'location', targetId: id });
  res.status(204).end();
});

// --- Droits RGPD ------------------------------------------------------------------------------

meRouter.get('/export', async (req, res) => {
  const data = await exportUserData(req.user!.id);
  await audit({ action: 'gdpr.export', req });
  res.set('Content-Disposition', 'attachment; filename="mes-donnees-501e.json"');
  res.set('Cache-Control', 'no-store');
  res.json(data);
});

meRouter.delete('/', async (req, res) => {
  parse(z.object({ confirm: z.literal('SUPPRIMER') }), req.body);
  await deleteUserData(req.user!.id, 'user_request');
  await destroySession(req, res);
  res.status(204).end();
});
