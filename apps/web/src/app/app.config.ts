import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { apiInterceptor } from './core/api.interceptor';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Transitions de page natives (ignorées si le navigateur ne les supporte pas).
      withViewTransitions({ skipInitialTransition: true }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiInterceptor]),
      // Double-submit cookie : le cookie XSRF-TOKEN émis par l'API est renvoyé en en-tête.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    provideClientHydration(
      withEventReplay(),
      // Les réponses GET faites pendant le SSR sont réutilisées à l'hydratation (pas de double appel).
      withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: false }),
      // Comportement antérieur à Angular 22 conservé (hydratation complète, non incrémentale).
      withNoIncrementalHydration(),
    ),
  ],
};
