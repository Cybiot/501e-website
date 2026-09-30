import type { RequestHandler } from 'express';
import { secureCookies } from '../config.js';
import { randomToken } from './crypto.js';
import { forbidden } from './errors.js';

/**
 * Protection CSRF « double submit cookie », compatible avec le support natif d'Angular
 * (cookie XSRF-TOKEN lisible par le front, renvoyé dans l'en-tête X-XSRF-TOKEN).
 * S'ajoute à SameSite=Lax sur le cookie de session.
 */
export const XSRF_COOKIE = 'XSRF-TOKEN';
export const XSRF_HEADER = 'x-xsrf-token';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrf: RequestHandler = (req, res, next) => {
  let token = req.cookies?.[XSRF_COOKIE] as string | undefined;
  if (!token) {
    token = randomToken(24);
    res.cookie(XSRF_COOKIE, token, { httpOnly: false, secure: secureCookies, sameSite: 'lax', path: '/' });
  }
  if (SAFE.has(req.method)) return next();
  const header = req.get(XSRF_HEADER);
  if (!header || header !== req.cookies?.[XSRF_COOKIE]) {
    return next(forbidden('Jeton CSRF invalide ou manquant. Recharge la page.', 'CSRF'));
  }
  next();
};
