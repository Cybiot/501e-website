import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { getSettings } from '../lib/settings.js';
import { refreshUserRoles } from './sync.js';

/** Durée de validité de la copie locale des rôles avant revérification auprès de Discord. */
const ROLE_CACHE_MS = 5 * 60 * 1000;

export const isMemberStatus = (s: string | undefined) => s === 'member' || s === 'admin';

async function ensureFreshStatus(req: Parameters<RequestHandler>[0]) {
  const user = req.user!;
  if (!user.rolesSyncedAt || Date.now() - user.rolesSyncedAt.getTime() > ROLE_CACHE_MS) {
    const updated = await refreshUserRoles(user.discordId);
    if (updated) {
      user.status = updated.status;
      user.rolesSyncedAt = updated.rolesSyncedAt;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

interface MemberOptions {
  /** Autorise l'accès sans consentement RGPD à jour (ex. : route d'acceptation du consentement). */
  allowWithoutConsent?: boolean;
}

/** Réservé aux membres (Membre ou Admin). Les connectés non-membres sont traités comme des visiteurs. */
export const requireMember =
  (opts: MemberOptions = {}): RequestHandler =>
  async (req, _res, next) => {
    try {
      if (!req.user) return next(unauthorized());
      await ensureFreshStatus(req);
      if (!isMemberStatus(req.user.status)) {
        return next(forbidden('Réservé aux membres de la 501e.', 'NOT_A_MEMBER'));
      }
      if (!opts.allowWithoutConsent) {
        const { consentVersion } = await getSettings();
        if (!req.user.consentAcceptedAt || req.user.consentVersion !== consentVersion) {
          return next(forbidden('Consentement requis.', 'CONSENT_REQUIRED'));
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next(unauthorized());
    await ensureFreshStatus(req);
    if (req.user.status !== 'admin') return next(forbidden('Réservé aux administrateurs.'));
    next();
  } catch (err) {
    next(err);
  }
};
