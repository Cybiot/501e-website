import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join } from 'node:path';
import companies from './content/compagnies.json';

/**
 * Serveur de production du front :
 *  - rendu serveur (SSR) des pages publiques ;
 *  - proxy /api → API interne (même origine : cookies de session SameSite, pas de CORS) ;
 *  - en-têtes de sécurité, sitemap.xml, robots.txt.
 */
const API_URL = (process.env['API_INTERNAL_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
const PUBLIC_URL = (process.env['PUBLIC_URL'] ?? 'http://localhost:4000').replace(/\/$/, '');
const TILE_URL = process.env['MAP_TILE_URL'] ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const isProd = process.env['NODE_ENV'] === 'production';

/** Origine autorisée pour les tuiles de carte (déduite de MAP_TILE_URL, sous-domaines {s} compris). */
function tileOrigin() {
  try {
    const host = new URL(TILE_URL.replace('{s}', 'a').replace(/\{[^}]+\}/g, '0')).host;
    return `https://${TILE_URL.includes('{s}') ? host.replace(/^a\./, '*.') : host}`;
  } catch {
    return '';
  }
}

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = express();
/**
 * Hôtes autorisés pour le rendu serveur (protection SSRF d'Angular) : hôte de PUBLIC_URL
 * + localhost. Liste complémentaire possible via NG_ALLOWED_HOSTS (séparée par des virgules).
 */
const allowedHosts = [
  new URL(PUBLIC_URL).hostname,
  'localhost',
  '127.0.0.1',
  ...(process.env['NG_ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim()).filter(Boolean),
];
const angularApp = new AngularNodeAppEngine({ allowedHosts });

app.disable('x-powered-by');
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.use(
  helmet({
    // En développement, le serveur Vite injecte ses propres scripts : CSP activée en production.
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            // Angular SSR injecte de petits scripts inline (hydratation, relecture d'événements).
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://cdn.discordapp.com', tileOrigin()].filter(Boolean),
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: PUBLIC_URL.startsWith('https://') ? [] : null,
          },
        }
      : false,
    hsts: PUBLIC_URL.startsWith('https://'),
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

// --- Proxy vers l'API ---------------------------------------------------------------------------
app.use(
  createProxyMiddleware({
    target: API_URL,
    pathFilter: ['/api'],
    changeOrigin: false,
    xfwd: true,
  }),
);

// --- SEO ------------------------------------------------------------------------------------------
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /profil',
      'Disallow: /carte',
      'Disallow: /connexion',
      'Disallow: /api/',
      `Sitemap: ${PUBLIC_URL}/sitemap.xml`,
      '',
    ].join('\n'),
  );
});

app.get('/sitemap.xml', async (_req, res) => {
  const staticPaths = [
    '/',
    '/communaute',
    '/communaute/regiment',
    '/compagnies',
    ...companies.map((c) => `/compagnies/${c.slug}`),
    '/membres',
    '/rejoindre',
    '/mentions-legales',
    '/confidentialite',
    '/cookies',
  ];
  let members: { id: string; updatedAt: string }[] = [];
  try {
    const r = await fetch(`${API_URL}/api/sitemap/members`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) members = (await r.json()) as typeof members;
  } catch {
    // Sitemap partiel si l'API est indisponible.
  }
  const urls = [
    ...staticPaths.map((p) => `<url><loc>${PUBLIC_URL}${p}</loc></url>`),
    ...members.map((m) => `<url><loc>${PUBLIC_URL}/membres/${m.id}</loc><lastmod>${m.updatedAt.slice(0, 10)}</lastmod></url>`),
  ];
  res
    .type('application/xml')
    .set('Cache-Control', 'public, max-age=3600')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
});

// --- Fichiers statiques ------------------------------------------------------------------------------
app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

// --- Rendu Angular -------------------------------------------------------------------------------
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) return next();
      // Le HTML peut dépendre de la session (cookie) : jamais mis en cache partagé.
      response.headers.set('Cache-Control', 'private, no-cache');
      return writeResponseToNodeResponse(response, res);
    })
    .catch(next);
});

/** Page 500 stylisée de dernier recours (si le rendu Angular lui-même échoue). */
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(JSON.stringify({ level: 'error', msg: 'Erreur de rendu', err: (err as Error)?.message }));
  res.status(500).type('html').send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Erreur · 501e</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b1a;color:#e8ecff;font-family:system-ui,sans-serif;text-align:center;padding:16px}
.s{display:inline-block;color:#c8322b;border:2px solid;padding:4px 12px;font:700 14px monospace;letter-spacing:.2em;transform:rotate(-4deg)}a{color:#ff8a57}</style></head>
<body><main><p class="s">ERREUR 500</p><h1>Transmission interrompue</h1><p>Une erreur est survenue de notre côté. Réessaie dans quelques instants.</p><p><a href="/">Retour à l'accueil</a></p></main></body></html>`);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Front 501e (SSR) sur http://localhost:${port} — API : ${API_URL}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
