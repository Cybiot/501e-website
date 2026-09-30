import cookieParser from 'cookie-parser';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { loadSession } from './auth/session.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { csrf } from './lib/csrf.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { adminRouter } from './routes/admin/index.js';
import { authRouter } from './routes/auth.js';
import { filesRouter } from './routes/files.js';
import { internalRouter } from './routes/internal.js';
import { mapRouter } from './routes/map.js';
import { meRouter } from './routes/me.js';
import { publicRouter } from './routes/public.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // L'API est derrière le serveur SSR (et éventuellement un reverse proxy) sur réseau privé.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.use(
    helmet({
      // L'API ne sert que du JSON et des images : politique la plus stricte possible.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      hsts: config.PUBLIC_URL.startsWith('https://'),
    }),
  );
  app.use(
    pinoHttp({
      logger,
      // Logs structurés sans données personnelles : ni IP, ni cookies, ni query string.
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, path: req.url.split('?')[0] }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  // Health check (Docker)
  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Routes internes (bot) : jeton partagé, pas de session ni de CSRF.
  app.use('/internal', internalRouter);

  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/api', loadSession, csrf);

  app.use('/api/auth', authRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/me', meRouter);
  app.use('/api/map', mapRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
