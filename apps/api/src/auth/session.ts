import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { config, secureCookies } from '../config.js';
import { prisma } from '../db.js';
import { randomToken, sha256 } from '../lib/crypto.js';

export const SESSION_COOKIE = 'sid501';
const TTL_MS = config.SESSION_TTL_DAYS * 24 * 3600 * 1000;
/** Fréquence maximale de prolongation de la session glissante. */
const TOUCH_MS = 15 * 60 * 1000;

const cookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: secureCookies,
  sameSite: 'lax',
  path: '/',
  maxAge,
});

export async function createSession(res: Response, userId: string) {
  const token = randomToken();
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(TTL_MS));
}

export async function destroySession(req: Request, res: Response) {
  if (req.sessionId) await prisma.session.deleteMany({ where: { id: req.sessionId } });
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

/**
 * Charge l'utilisateur de la session. Le statut vient TOUJOURS de la base (pas du cookie) :
 * une perte de rôle est donc effective dès la requête suivante.
 */
export const loadSession: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return next();
  try {
    const id = sha256(token);
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            discordId: true,
            displayName: true,
            discordAvatarUrl: true,
            status: true,
            consentVersion: true,
            consentAcceptedAt: true,
            rolesSyncedAt: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!session || session.expiresAt < new Date() || session.user.deletedAt) {
      if (session) await prisma.session.delete({ where: { id } }).catch(() => undefined);
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      return next();
    }
    const { deletedAt: _deleted, ...user } = session.user;
    req.user = user;
    req.sessionId = id;
    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_MS) {
      const now = new Date();
      await prisma.$transaction([
        prisma.session.update({
          where: { id },
          data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + TTL_MS) },
        }),
        prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: now } }),
      ]);
      res.cookie(SESSION_COOKIE, token, cookieOptions(TTL_MS));
    }
    next();
  } catch (err) {
    next(err);
  }
};
