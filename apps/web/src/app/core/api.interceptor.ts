import { isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken, PLATFORM_ID, REQUEST } from '@angular/core';

/** URL de l'API vue depuis le serveur SSR (fournie par app.config.server.ts). */
export const API_INTERNAL_URL = new InjectionToken<string>('API_INTERNAL_URL');

/**
 * Pendant le rendu serveur, les appels relatifs /api/... sont redirigés vers l'API interne
 * et reçoivent les cookies de la requête d'origine (session), pour que le HTML servi
 * corresponde au statut réel du visiteur — sans jamais y inclure de données non autorisées,
 * puisque c'est l'API qui filtre.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID)) || !req.url.startsWith('/api/')) return next(req);
  const base = inject(API_INTERNAL_URL, { optional: true }) ?? 'http://localhost:3000';
  const incoming = inject(REQUEST, { optional: true });
  const cookie = incoming?.headers.get('cookie');
  return next(
    req.clone({
      url: `${base.replace(/\/$/, '')}${req.url}`,
      setHeaders: cookie ? { cookie } : {},
    }),
  );
};
