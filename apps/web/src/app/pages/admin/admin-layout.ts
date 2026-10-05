import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TPipe } from '../../core/i18n';
import { NotificationsService } from '../../core/notifications.service';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe, IconComponent],
  template: `
    <div class="admin container">
      <nav class="admin__nav" aria-label="Administration">
        <p class="eyebrow">Administration</p>
        <ul>
          @for (l of links; track l.path) {
            <li>
              <a [routerLink]="l.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
                <app-icon [name]="l.icon" [size]="18" /> <span>{{ l.label | t }}</span>
                @if (l.path === '/admin/logs' && unread() > 0) {
                  <span class="count-badge" [attr.aria-label]="unread() + ' notifications non lues'">{{ unread() }}</span>
                }
              </a>
            </li>
          }
        </ul>
      </nav>
      <div class="admin__content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    .admin {
      display: grid;
      gap: var(--space-5);
      padding-top: var(--space-5);
      /* minmax(0, …) : sans lui, la colonne s'élargit à la taille des onglets (nowrap) et la page déborde. */
      grid-template-columns: minmax(0, 1fr);
    }
    @media (min-width: 1000px) {
      .admin {
        grid-template-columns: 230px minmax(0, 1fr);
      }
      .admin__nav {
        position: sticky;
        top: calc(var(--header-h) + 20px);
        align-self: start;
      }
    }
    /* Mobile et tablette : grille d'onglets, tous visibles. Bureau : colonne latérale. */
    .admin__nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-1);
    }
    @media (min-width: 1000px) {
      .admin__nav ul {
        display: flex;
        flex-direction: column;
      }
    }
    .admin__nav a {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      text-decoration: none;
      font-size: var(--fs-sm);
      font-weight: 500;
      line-height: 1.25;
    }
    .admin__nav a:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .admin__nav a.active {
      background: var(--olive-soft);
      color: var(--text);
      box-shadow: inset 3px 0 0 var(--gold);
    }
    .admin__nav .count-badge {
      margin-left: auto;
    }
    .admin__content {
      min-width: 0;
    }
  `,
})
export class AdminLayout {
  protected readonly unread = inject(NotificationsService).unread;
  protected readonly links = [
    { path: '/admin', icon: 'dashboard', label: 'admin.dashboard' },
    { path: '/admin/medailles', icon: 'award', label: 'admin.awards' },
    { path: '/admin/medailles/catalogue', icon: 'list', label: 'admin.catalog' },
    { path: '/admin/grades', icon: 'shield', label: 'admin.ranks' },
    { path: '/admin/moderation', icon: 'image', label: 'admin.moderation' },
    { path: '/admin/logs', icon: 'bell', label: 'admin.logs' },
    { path: '/admin/parametres', icon: 'settings', label: 'admin.settings' },
  ];
  constructor() {
    inject(SeoService).set({ title: 'Administration', path: '/admin', noindex: true });
  }
}
