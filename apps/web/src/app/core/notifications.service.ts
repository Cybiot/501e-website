import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Api } from './api.service';
import { AuthService } from './auth.service';

/** Compteur de notifications non lues (admin), partagé entre le header et le menu admin. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  readonly unread = signal(0);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    // Rafraîchi toutes les 60 s tant que l'utilisateur est admin.
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(timer);
      if (!this.auth.isAdmin()) {
        this.unread.set(0);
        return;
      }
      void this.refresh();
      timer = setInterval(() => void this.refresh(), 60_000);
    });
  }

  refresh() {
    return this.api
      .get<{ count: number }>('/admin/notifications/unread-count')
      .then((r) => this.unread.set(r.count))
      .catch(() => undefined);
  }
}
