import { isPlatformServer } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  RESPONSE_INIT,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import companies from '../../../content/compagnies.json';
import { Api } from '../../core/api.service';
import { CommandRole, CompanyRoster } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { IconComponent } from '../../shared/icon.component';

/** Fiche d'une compagnie : présentation (contenu statique) et effectif groupé par platoon (API). */
@Component({
  selector: 'app-company-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, BreadcrumbComponent, IconComponent],
  template: `
    <div class="container">
      @if (company(); as co) {
        <div class="page-header" style="padding-bottom: 0">
          <app-breadcrumb
            [items]="[{ label: 'Les compagnies', link: '/compagnies' }, { label: co.name }]"
          />
        </div>

        <div class="layout">
          <article class="main">
            <header class="hero">
              <img
                class="hero__logo"
                [src]="'/logo/compagnies/' + co.slug + '-320.webp'"
                [alt]="'Insigne de la compagnie ' + co.name"
                width="320"
                height="320"
              />
              <div>
                <p class="eyebrow">{{ co.unit }}</p>
                <h1>{{ co.name }}</h1>
                <p class="motto">« {{ co.motto }} »</p>
              </div>
            </header>
            @for (p of co.description; track $index) {
              <p class="lead-text">{{ p }}</p>
            }

            <nav class="others" aria-label="Autres compagnies">
              @for (o of others(); track o.slug) {
                <a
                  class="others__item card card--interactive"
                  [routerLink]="['/compagnies', o.slug]"
                >
                  <img
                    [src]="'/logo/compagnies/' + o.slug + '-160.webp'"
                    alt=""
                    width="48"
                    height="48"
                    loading="lazy"
                  />
                  <span>
                    <span class="others__name">{{ o.name }}</span>
                    <span class="small muted">{{ o.unit }}</span>
                  </span>
                </a>
              }
            </nav>
          </article>

          <aside class="roster card" aria-labelledby="roster-title">
            <h2 id="roster-title" class="roster__title">
              <app-icon name="users" [size]="18" /> Effectif
              @if (roster(); as r) {
                <span class="badge">{{ r.memberCount }}</span>
              }
            </h2>
            @switch (state()) {
              @case ('loading') {
                <div class="stack" aria-busy="true">
                  @for (i of [1, 2, 3, 4]; track i) {
                    <div class="skeleton" style="height: 36px"></div>
                  }
                </div>
              }
              @case ('error') {
                <p class="small muted">Impossible de charger l'effectif.</p>
                <button type="button" class="btn btn--sm" (click)="load(co.slug)">Réessayer</button>
              }
              @default {
                @if (roster(); as r) {
                  @for (g of r.groups; track g.id) {
                    <section class="roster__group">
                      <h3 class="roster__group-title">
                        {{ g.name }} <span class="muted">· {{ g.members.length }}</span>
                      </h3>
                      <ul class="roster__list">
                        @for (m of g.members; track m.id) {
                          <li>
                            <a
                              class="roster__member"
                              [class.roster__member--lead]="
                                m.command === 'co' || m.command === 'xo'
                              "
                              [class.roster__member--pl]="m.command === 'pl'"
                              [routerLink]="['/membres', m.id]"
                            >
                              <app-avatar
                                [src]="m.avatarUrl"
                                [name]="m.displayName"
                                [size]="m.command === 'co' || m.command === 'xo' ? 40 : 32"
                                [alt]="false"
                              />
                              <span class="roster__who">
                                <span class="roster__name">{{ m.displayName }}</span>
                                @if (m.command) {
                                  <span class="roster__command">
                                    <abbr [title]="commandLabels[m.command]">{{
                                      m.command.toUpperCase()
                                    }}</abbr>
                                    · {{ commandLabels[m.command] }}
                                  </span>
                                }
                              </span>
                              @if (m.rank; as rank) {
                                @if (rank.iconUrl) {
                                  <img
                                    class="roster__rank"
                                    [src]="rank.iconUrl"
                                    [alt]="rank.name"
                                    [title]="rank.name"
                                    width="24"
                                    height="24"
                                  />
                                } @else {
                                  <span class="mono small muted" [title]="rank.name">{{
                                    rank.abbreviation
                                  }}</span>
                                }
                              }
                            </a>
                          </li>
                        }
                      </ul>
                    </section>
                  } @empty {
                    <p class="small muted">Aucun membre à afficher pour le moment.</p>
                  }
                }
              }
            }
          </aside>
        </div>
      } @else {
        <div class="empty" style="margin-top: var(--space-6)">
          <app-icon name="flag" [size]="36" />
          <h1 style="font-size: var(--fs-2xl)">Compagnie introuvable</h1>
          <a class="btn" routerLink="/compagnies">Voir les compagnies</a>
        </div>
      }
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
      padding-block: var(--space-6) var(--space-8);
    }
    @media (min-width: 960px) {
      .layout {
        grid-template-columns: minmax(0, 1fr) 400px;
        align-items: start;
      }
      .roster {
        position: sticky;
        top: calc(var(--header-h) + var(--space-4));
        max-height: calc(100vh - var(--header-h) - var(--space-6));
        overflow-y: auto;
      }
    }
    .hero {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-5);
      margin-bottom: var(--space-5);
    }
    .hero__logo {
      width: 160px;
      height: 160px;
      object-fit: contain;
      filter: drop-shadow(0 8px 18px rgb(0 0 0 / 0.4));
    }
    .hero h1 {
      margin: 0 0 var(--space-2);
    }
    .motto {
      font-family: var(--font-display);
      font-style: italic;
      color: var(--gold-text);
      font-size: var(--fs-lg);
      margin: 0;
    }
    .lead-text {
      max-width: 70ch;
    }
    .others {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
      gap: var(--space-3);
      margin-top: var(--space-6);
    }
    .others__item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      color: inherit;
      text-decoration: none;
    }
    .others__item img {
      object-fit: contain;
      flex-shrink: 0;
    }
    .others__item > span {
      display: flex;
      flex-direction: column;
    }
    .others__name {
      font-weight: 600;
    }
    .roster__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--fs-lg);
      margin-bottom: var(--space-4);
    }
    .roster__group + .roster__group {
      margin-top: var(--space-5);
    }
    .roster__group-title {
      font-size: var(--fs-sm);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--gold-text);
      margin: 0 0 var(--space-2);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--border);
    }
    .roster__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .roster__member {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2);
      margin-inline: calc(-1 * var(--space-2));
      border-radius: var(--radius-sm);
      color: inherit;
      text-decoration: none;
    }
    .roster__member:hover,
    .roster__member:focus-visible {
      background: var(--surface-2);
    }
    .roster__member--lead {
      background: var(--gold-soft);
      border: 1px solid rgb(var(--gold-rgb) / 0.35);
      margin-inline: 0;
      margin-bottom: var(--space-2);
      padding: var(--space-3);
    }
    .roster__member--pl {
      box-shadow: inset 3px 0 0 var(--olive);
      padding-left: var(--space-3);
    }
    .roster__who {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .roster__member--lead .roster__name {
      font-weight: 600;
    }
    .roster__command {
      font-size: var(--fs-xs);
      color: var(--gold-text);
      letter-spacing: 0.02em;
    }
    .roster__member--pl .roster__command {
      color: var(--olive-text);
    }
    .roster__command abbr {
      text-decoration: none;
      font-weight: 700;
    }
    .roster__name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .roster__rank {
      flex-shrink: 0;
    }
  `,
})
export class CompanyPage {
  private readonly api = inject(Api);
  private readonly seo = inject(SeoService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly server = isPlatformServer(inject(PLATFORM_ID));

  readonly slug = input.required<string>();
  protected readonly company = computed(
    () => companies.find((c) => c.slug === this.slug()) ?? null,
  );
  protected readonly others = computed(() => companies.filter((c) => c.slug !== this.slug()));
  protected readonly roster = signal<CompanyRoster | null>(null);
  protected readonly commandLabels: Record<CommandRole, string> = {
    co: 'Commanding Officer',
    xo: 'Executive Officer',
    pl: 'Platoon Leader',
  };
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');

  constructor() {
    effect(() => {
      const co = this.company();
      const slug = this.slug();
      untracked(() => {
        if (!co) {
          if (this.server && this.responseInit) this.responseInit.status = 404;
          this.seo.set({
            title: 'Compagnie introuvable',
            path: `/compagnies/${slug}`,
            noindex: true,
          });
          return;
        }
        this.seo.set({
          title: `${co.name} — ${co.unit}`,
          description: co.summary,
          path: `/compagnies/${co.slug}`,
          image: `/logo/compagnies/${co.slug}-320.webp`,
        });
        void this.load(co.slug);
      });
    });
  }

  protected async load(slug: string) {
    this.state.set('loading');
    this.roster.set(null);
    try {
      this.roster.set(await this.api.get<CompanyRoster>(`/companies/${encodeURIComponent(slug)}`));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
