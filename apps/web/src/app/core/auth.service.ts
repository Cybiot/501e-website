import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api.service';
import { Me } from './models';

/** État de connexion (signal) partagé par toute l'application. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly me = signal<Me>({ user: null, status: 'visitor' });
  readonly loaded = signal(false);
  private pending: Promise<Me> | null = null;

  readonly user = computed(() => this.me().user);
  readonly status = computed(() => this.me().status);
  /** Membre ou admin : accès à l'espace membre. Un connecté non-membre reste un visiteur. */
  readonly isMember = computed(() => ['member', 'admin'].includes(this.status()));
  readonly isAdmin = computed(() => this.status() === 'admin');
  readonly isLoggedIn = computed(() => this.me().user !== null);
  readonly isOutsider = computed(() => this.status() === 'none');
  readonly consentRequired = computed(() => Boolean(this.me().consentRequired));

  /** Libellé du badge de statut (menu utilisateur). */
  readonly statusLabel = computed(() =>
    this.isAdmin() ? 'Admin' : this.isMember() ? 'Membre' : 'Visiteur',
  );

  load(force = false): Promise<Me> {
    if (this.loaded() && !force) return Promise.resolve(this.me());
    if (this.pending && !force) return this.pending;
    this.pending = this.api
      .get<Me>('/auth/me')
      .catch(() => ({ user: null, status: 'visitor' }) as Me)
      .then((me) => {
        this.me.set(me);
        this.loaded.set(true);
        this.pending = null;
        return me;
      });
    return this.pending;
  }

  /** URL de connexion Discord, avec retour sur la page courante. */
  loginUrl(redirect?: string) {
    const r = redirect ?? (this.isBrowser ? location.pathname + location.search : '/');
    return `/api/auth/discord/login?redirect=${encodeURIComponent(r)}`;
  }

  async logout() {
    await this.api.post('/auth/logout').catch(() => undefined);
    this.me.set({ user: null, status: 'visitor' });
    await this.router.navigateByUrl('/');
  }
}
