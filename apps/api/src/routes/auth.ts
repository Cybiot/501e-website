import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createSession, destroySession } from '../auth/session.js';
import { applyMemberInfo } from '../auth/sync.js';
import { config, isMockDiscord, secureCookies } from '../config.js';
import { prisma } from '../db.js';
import { authorizeUrl, exchangeCode, fetchIdentity, type OAuthIdentity } from '../discord/oauth.js';
import { MOCK_ROLES } from '../discord/mock-data.js';
import { audit } from '../lib/audit.js';
import { randomToken } from '../lib/crypto.js';
import { notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getSettings } from '../lib/settings.js';
import { stripRankPrefix } from '../lib/rank-prefix.js';
import { parse } from '../lib/validate.js';

export const authRouter = Router();

const STATE_COOKIE = 'oauth501';

const authLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

/** N'accepte que des chemins internes (évite les redirections ouvertes). */
export const safeRedirect = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.startsWith('/api')) {
    return null;
  }
  return value.slice(0, 300);
};

/** Informations de session exposées au front (menu, badge de statut, modale de consentement). */
authRouter.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.user) {
    res.json({ user: null, status: 'visitor' });
    return;
  }
  const settings = await getSettings();
  const u = req.user;
  const isMember = u.status === 'member' || u.status === 'admin';
  const consentRequired = isMember && (!u.consentAcceptedAt || u.consentVersion !== settings.consentVersion);
  res.json({
    user: {
      id: u.id,
      discordId: u.discordId,
      displayName: stripRankPrefix(u.displayName),
      avatarUrl: u.discordAvatarUrl,
    },
    // « none » = connecté non-membre : traité exactement comme un visiteur.
    status: u.status,
    consentRequired,
    consent: consentRequired ? { version: settings.consentVersion, text: settings.consentText } : null,
  });
});

/**
 * Point commun aux connexions Discord et démo : création/mise à jour de l'utilisateur,
 * calcul du statut à partir des rôles, ouverture de session.
 */
async function completeLogin(req: Request, res: Response, identity: OAuthIdentity, redirect: string | null) {
  const existing = await prisma.user.findUnique({ where: { discordId: identity.discordId } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { displayName: identity.displayName, discordAvatarUrl: identity.avatarUrl, lastLoginAt: new Date() },
      })
    : await prisma.user.create({
        data: {
          discordId: identity.discordId,
          displayName: identity.displayName,
          discordAvatarUrl: identity.avatarUrl,
          lastLoginAt: new Date(),
        },
      });
  const synced = (await applyMemberInfo(identity.discordId, identity.member)) ?? user;
  await createSession(res, user.id);
  await audit({ action: 'auth.login', actorId: user.id, req, metadata: { status: synced.status } });
  const isMember = synced.status !== 'none';
  // Première connexion d'un membre : direction « Mon profil » (modale de consentement).
  const target = isMember && !synced.consentAcceptedAt ? '/profil' : (redirect ?? '/');
  return target;
}

// --- Connexion Discord (OAuth2) ----------------------------------------------------------------

authRouter.get('/discord/login', authLimiter, (req, res) => {
  if (isMockDiscord) {
    const r = safeRedirect(req.query.redirect);
    res.redirect(302, `/connexion${r ? `?redirect=${encodeURIComponent(r)}` : ''}`);
    return;
  }
  const state = randomToken(24);
  const redirect = safeRedirect(req.query.redirect) ?? '';
  res.cookie(STATE_COOKIE, JSON.stringify({ state, redirect }), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(302, authorizeUrl(state));
});

authRouter.get('/discord/callback', authLimiter, async (req, res) => {
  const fail = (code: string) => res.redirect(302, `${config.PUBLIC_URL}/connexion?erreur=${code}`);
  let stored: { state?: string; redirect?: string } = {};
  try {
    stored = JSON.parse((req.cookies?.[STATE_COOKIE] as string) ?? '{}');
  } catch {
    stored = {};
  }
  res.clearCookie(STATE_COOKIE, { path: '/api/auth' });

  if (req.query.error) {
    // L'utilisateur a refusé l'autorisation sur Discord.
    await audit({ action: 'auth.login_failed', req, metadata: { reason: 'denied' } });
    return fail('refus');
  }
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code || !stored.state || req.query.state !== stored.state) return fail('session');

  try {
    const token = await exchangeCode(code);
    const identity = await fetchIdentity(token);
    const target = await completeLogin(req, res, identity, safeRedirect(stored.redirect));
    res.redirect(302, `${config.PUBLIC_URL}${target}`);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Échec de connexion Discord');
    await audit({ action: 'auth.login_failed', req, metadata: { reason: 'discord_error' } });
    fail('discord');
  }
});

authRouter.post('/logout', async (req, res) => {
  if (req.user) await audit({ action: 'auth.logout', req });
  await destroySession(req, res);
  res.status(204).end();
});

// --- Mode démo (DISCORD_MODE=mock uniquement) --------------------------------------------------

/** Comptes fictifs proposés sur l'écran de connexion démo. */
authRouter.get('/demo/accounts', async (_req, res) => {
  if (!isMockDiscord) throw notFound();
  const users = await prisma.user.findMany({
    where: { deletedAt: null, discordId: { startsWith: 'demo-' } },
    include: { rank: true },
    orderBy: [{ status: 'desc' }, { displayName: 'asc' }],
  });
  res.json(
    users.map((u) => ({
      discordId: u.discordId,
      displayName: u.displayName,
      avatarUrl: u.discordAvatarUrl,
      status: u.discordRoleIds.includes(MOCK_ROLES.admin.id)
        ? 'admin'
        : u.discordRoleIds.includes(MOCK_ROLES.member.id)
          ? 'member'
          : 'none',
      rank: u.rank?.name ?? null,
    })),
  );
});

authRouter.post('/demo/login', authLimiter, async (req, res) => {
  if (!isMockDiscord) throw notFound();
  const body = parse(
    z.object({ discordId: z.string().min(1).max(64), redirect: z.string().optional() }),
    req.body,
  );
  const user = await prisma.user.findUnique({ where: { discordId: body.discordId } });
  if (!user || user.deletedAt) throw notFound('Compte de démonstration introuvable.');
  const identity: OAuthIdentity = {
    discordId: user.discordId,
    displayName: user.displayName,
    avatarUrl: user.discordAvatarUrl,
    member:
      user.discordRoleIds.length > 0
        ? {
            discordId: user.discordId,
            displayName: user.displayName,
            avatarUrl: user.discordAvatarUrl,
            roles: user.discordRoleIds,
            joinedAt: user.joinedAt,
          }
        : null,
  };
  const target = await completeLogin(req, res, identity, safeRedirect(body.redirect));
  res.json({ redirect: target });
});
