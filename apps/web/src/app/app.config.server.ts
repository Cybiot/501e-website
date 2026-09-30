import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_INTERNAL_URL } from './core/api.interceptor';
import { PUBLIC_URL } from './core/seo.service';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_INTERNAL_URL, useFactory: () => process.env['API_INTERNAL_URL'] ?? 'http://localhost:3000' },
    { provide: PUBLIC_URL, useFactory: () => process.env['PUBLIC_URL'] ?? '' },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
