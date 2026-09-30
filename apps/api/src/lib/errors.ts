import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

/** Erreur HTTP normalisée : { error: { code, message, details? } } */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Connexion requise.') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Accès refusé.', code = 'FORBIDDEN') =>
  new HttpError(403, code, message);
export const notFound = (message = 'Ressource introuvable.') =>
  new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
  new HttpError(409, code, message, details);

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Route inconnue.'));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  const e = err as { type?: string; status?: number; code?: string };
  if (e?.type === 'entity.too.large' || e?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Fichier ou requête trop volumineux.' } });
    return;
  }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'JSON invalide.' } });
    return;
  }
  logger.error({ err, path: req.path }, 'Erreur non gérée');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' } });
};
