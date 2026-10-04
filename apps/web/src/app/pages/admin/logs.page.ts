import { DatePipe, JsonPipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { AuditLogItem, NotificationItem, Page } from '../../core/models';
import { NotificationsService } from '../../core/notifications.service';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { ACTION_LABELS, NOTIFICATION_LABELS } from './labels';

@Component({
  selector: 'app-logs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JsonPipe, KeyValuePipe, FormsModule, RouterLink, IconComponent],
  templateUrl: './logs.page.html',
  styleUrl: './admin.css',
})
export class LogsPage {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly notifs = inject(NotificationsService);

  protected readonly tab = signal<'notifications' | 'logs'>('notifications');
  protected readonly notifLabels = NOTIFICATION_LABELS;

  // Notifications
  protected readonly notifications = signal<Page<NotificationItem> | null>(null);
  protected notifType = '';
  protected unreadOnly = false;
  protected notifPage = 1;

  // Journal
  protected readonly logs = signal<(Page<AuditLogItem> & { actions: string[] }) | null>(null);
  protected logFilters = { from: '', to: '', action: '', q: '' };
  protected logPage = 1;

  constructor() {
    void this.loadNotifications();
    // Mise à jour en quasi temps réel des notifications.
    const timer = setInterval(() => {
      if (this.tab() === 'notifications') void this.loadNotifications(true);
    }, 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected label = (a: string) => ACTION_LABELS[a] ?? a;

  protected switchTab(t: 'notifications' | 'logs') {
    this.tab.set(t);
    if (t === 'logs' && !this.logs()) void this.loadLogs();
  }

  protected async loadNotifications(silent = false) {
    try {
      this.notifications.set(
        await this.api.get<Page<NotificationItem>>('/admin/notifications', {
          type: this.notifType,
          unread: this.unreadOnly ? 'true' : undefined,
          page: this.notifPage,
        }),
      );
      void this.notifs.refresh();
    } catch (err) {
      if (!silent) this.toast.error((err as ApiError).message);
    }
  }

  protected describe(n: NotificationItem): string {
    const p = n.payload as Record<string, unknown>;
    switch (n.type) {
      case 'join_click':
        return `${p['count'] ?? 1} clic(s) sur le bouton${(p['discordIds'] as string[] | undefined)?.length ? ` dont ${(p['discordIds'] as string[]).length} utilisateur(s) connecté(s)` : ' (anonyme)'}.`;
      case 'image_submitted':
        return `${p['displayName']} a envoyé une nouvelle image.`;
      case 'new_member':
        return `${p['displayName']} s'est connecté pour la première fois.`;
      case 'discord_error':
        return `Action « ${p['action']} » : ${p['message']}`;
      case 'inactive_account':
        return `${p['displayName']} est inactif ; son compte sera supprimé dans un mois.`;
      default:
        return JSON.stringify(p);
    }
  }

  protected async markRead(n: NotificationItem) {
    try {
      await this.api.post(`/admin/notifications/${n.id}/read`);
      await this.loadNotifications();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  protected async markAllRead() {
    try {
      await this.api.post('/admin/notifications/read-all');
      this.toast.success('Toutes les notifications sont marquées comme lues.');
      await this.loadNotifications();
    } catch (err) {
      this.toast.error((err as ApiError).message);
    }
  }

  private logParams() {
    return {
      from: this.logFilters.from ? new Date(this.logFilters.from).toISOString() : undefined,
      to: this.logFilters.to ? new Date(`${this.logFilters.to}T23:59:59`).toISOString() : undefined,
      action: this.logFilters.action,
      q: this.logFilters.q,
    };
  }

  protected async loadLogs() {
    try {
      this.logs.set(await this.api.get('/admin/logs', { ...this.logParams(), page: this.logPage }));
    } catch (err) {
      this.toast.error((err as ApiError).message, () => void this.loadLogs());
    }
  }

  protected exportUrl() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(this.logParams())) if (v) params.set(k, v);
    return `/api/admin/logs/export.csv?${params}`;
  }
}
