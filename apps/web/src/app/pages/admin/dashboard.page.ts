import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ApiError } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { ACTION_LABELS } from './labels';

interface Dashboard {
  counts: {
    members: number;
    admins: number;
    hiddenProfiles: number;
    pendingImages: number;
    unreadNotifications: number;
    pendingAwards: number;
    locations: number;
  };
  recentLogs: { id: string; createdAt: string; action: string; actor: string | null }[];
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <h1 class="admin-title">Tableau de bord</h1>
    @if (error()) {
      <div class="alert alert--danger"><app-icon name="alert-triangle" [size]="18" /><span>{{ error() }}</span></div>
    }
    @if (data(); as d) {
      <div class="grid kpis" style="--min: 260px">
        <a class="card card--interactive kpi" routerLink="/membres">
          <app-icon name="users" [size]="20" /><strong>{{ d.counts.members }}</strong><span>membres ({{ d.counts.admins }} admins)</span>
        </a>
        <a class="card card--interactive kpi" routerLink="/admin/moderation" [class.kpi--alert]="d.counts.pendingImages > 0">
          <app-icon name="image" [size]="20" /><strong>{{ d.counts.pendingImages }}</strong><span>images à modérer</span>
        </a>
        <a class="card card--interactive kpi" routerLink="/admin/medailles" [class.kpi--alert]="d.counts.pendingAwards > 0">
          <app-icon name="send" [size]="20" /><strong>{{ d.counts.pendingAwards }}</strong><span>médailles à annoncer</span>
        </a>
        <a class="card card--interactive kpi" routerLink="/admin/logs" [class.kpi--alert]="d.counts.unreadNotifications > 0">
          <app-icon name="bell" [size]="20" /><strong>{{ d.counts.unreadNotifications }}</strong><span>notifications non lues</span>
        </a>
        <div class="card kpi">
          <app-icon name="eye-off" [size]="20" /><strong>{{ d.counts.hiddenProfiles }}</strong><span>profils masqués au public</span>
        </div>
        <div class="card kpi">
          <app-icon name="map-pin" [size]="20" /><strong>{{ d.counts.locations }}</strong><span>villes sur la carte</span>
        </div>
      </div>

      <div class="grid" style="--min: 320px; margin-top: var(--space-5)">
        <section class="card">
          <h2 class="card-title">Actions rapides</h2>
          <div class="stack">
            <a class="btn btn--primary btn--block" routerLink="/admin/medailles"><app-icon name="award" [size]="16" /> Attribuer une médaille</a>
            <a class="btn btn--block" routerLink="/admin/medailles/catalogue"><app-icon name="plus" [size]="16" /> Créer une médaille</a>
            <a class="btn btn--block" routerLink="/admin/parametres"><app-icon name="settings" [size]="16" /> Vérifier l'intégration Discord</a>
          </div>
        </section>
        <section class="card">
          <div class="row row--between"><h2 class="card-title">Activité récente</h2><a routerLink="/admin/logs" class="small">Tout voir</a></div>
          <ul class="activity">
            @for (l of d.recentLogs; track l.id) {
              <li>
                <span class="mono small muted">{{ l.createdAt | date: 'dd/MM HH:mm' }}</span>
                <span>{{ label(l.action) }}</span>
                <span class="small muted">{{ l.actor ?? 'système' }}</span>
              </li>
            } @empty {
              <li class="muted small">Aucune activité.</li>
            }
          </ul>
        </section>
      </div>
    } @else if (!error()) {
      <div class="grid" style="--min: 190px">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="skeleton" style="height: 110px"></div>
        }
      </div>
    }
  `,
  styles: `
    /* 6 indicateurs : 3 + 3 sur grand écran (--min), 2 colonnes sur téléphone. */
    @media (max-width: 599px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      text-decoration: none;
      color: var(--text);
    }
    .kpi app-icon {
      color: var(--olive-text);
      margin-bottom: var(--space-2);
    }
    .kpi strong {
      font-family: var(--font-display);
      font-size: var(--fs-2xl);
      line-height: 1;
    }
    .kpi span {
      font-size: var(--fs-sm);
      color: var(--text-muted);
    }
    .kpi--alert {
      border-color: rgb(var(--gold-rgb) / 0.55);
    }
    .kpi--alert app-icon,
    .kpi--alert strong {
      color: var(--gold-text);
    }
    .activity {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .activity li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--border);
      font-size: var(--fs-sm);
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(Api);
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly label = (a: string) => ACTION_LABELS[a] ?? a;

  constructor() {
    this.api
      .get<Dashboard>('/admin/dashboard')
      .then((d) => this.data.set(d))
      .catch((e: ApiError) => this.error.set(e.message));
  }
}
