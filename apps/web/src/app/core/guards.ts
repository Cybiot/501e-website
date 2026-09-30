import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Gardes côté client : confort de navigation uniquement.
 * La sécurité réelle est appliquée par l'API sur chaque route.
 */
export const memberGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  if (auth.isMember()) return true;
  return router.createUrlTree(['/connexion'], {
    queryParams: { redirect: state.url, raison: auth.isLoggedIn() ? 'non-membre' : 'membre' },
  });
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  if (auth.isAdmin()) return true;
  if (auth.isLoggedIn()) return router.createUrlTree(['/']);
  return router.createUrlTree(['/connexion'], { queryParams: { redirect: state.url } });
};
