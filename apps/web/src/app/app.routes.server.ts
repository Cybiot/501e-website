import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Pages publiques : rendu serveur (SEO, lisibles sans JavaScript, aperçus Open Graph).
 * Espace membre et administration : rendu client (aucun intérêt SEO, données privées).
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'carte', renderMode: RenderMode.Client },
  { path: 'profil', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'connexion', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
