import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import content from '../../../content/regiment.json';
import { SeoService } from '../../core/seo.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { IconComponent } from '../../shared/icon.component';

/** Frise chronologique interactive (navigation clavier : flèches gauche/droite). */
@Component({
  selector: 'app-regiment-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbComponent, IconComponent],
  template: `
    <div class="container">
      <header class="page-header">
        <app-breadcrumb [items]="[{ label: 'La communauté', link: '/communaute' }, { label: 'Le 501st PIR' }]" />
        <p class="eyebrow" style="margin-top: var(--space-5)">Contexte historique</p>
        <h1>Le 501st PIR</h1>
        <p>{{ c.intro }}</p>
      </header>

      <section aria-labelledby="tl-title" class="section section--tight">
        <h2 id="tl-title" class="sr-only">Frise chronologique</h2>
        <div class="tl" role="tablist" aria-label="Périodes" (keydown)="onKey($event)">
          @for (e of c.timeline; track e.period; let i = $index) {
            <button
              type="button"
              role="tab"
              class="tl__stop"
              [id]="'tab-' + i"
              [attr.aria-selected]="i === active()"
              [attr.aria-controls]="'panel-' + i"
              [attr.tabindex]="i === active() ? 0 : -1"
              (click)="select(i)"
            >
              <span class="tl__dot"><app-icon [name]="e.icon" [size]="16" /></span>
              <span class="tl__period mono">{{ e.period }}</span>
              <span class="tl__label">{{ e.title }}</span>
            </button>
          }
        </div>

        @if (current(); as e) {
          <article class="tl__panel card" role="tabpanel" [id]="'panel-' + active()" [attr.aria-labelledby]="'tab-' + active()">
            <p class="eyebrow">{{ e.period }} · {{ e.place }}</p>
            <h3>{{ e.title }}</h3>
            @for (p of e.paragraphs; track $index) {
              <p>{{ p }}</p>
            }
            @if (e.quote) {
              <blockquote class="tl__quote">{{ e.quote }}</blockquote>
            }
            <div class="row">
              <button type="button" class="btn btn--sm" (click)="move(-1)" [disabled]="active() === 0">
                <app-icon name="chevron-left" [size]="16" /> Précédent
              </button>
              <span class="muted mono tl__count">{{ active() + 1 }} / {{ c.timeline.length }}</span>
              <button type="button" class="btn btn--sm" (click)="move(1)" [disabled]="active() === c.timeline.length - 1">
                Suivant <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          </article>
        }
      </section>

      <section class="section section--tight prose" aria-labelledby="motto-title">
        <h2 id="motto-title">{{ c.motto.title }}</h2>
        @for (p of c.motto.paragraphs; track $index) {
          <p>{{ p }}</p>
        }
      </section>

      <section class="section section--tight prose" aria-labelledby="src-title">
        <h2 id="src-title">Sources et crédits</h2>
        <p>{{ c.credit }}</p>
        <h3>Sources</h3>
        <ul>
          @for (s of c.sources; track s.url + s.label) {
            <li><a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.label }}</a></li>
          }
        </ul>
        <h3>Vidéos</h3>
        <ul>
          @for (v of c.videos; track v.url) {
            <li><a [href]="v.url" target="_blank" rel="noopener noreferrer">{{ v.label }}</a></li>
          }
        </ul>
        <p class="muted">{{ c.visualCredit }}</p>
      </section>
    </div>
  `,
  styles: `
    .tl {
      display: flex;
      gap: 0;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;
      /* marge pour le cercle agrandi (scale 1.1) : overflow-x:auto rogne aussi en vertical */
      padding: var(--space-2) 0;
      margin-bottom: var(--space-5);
    }
    .tl__stop {
      flex: 0 0 120px;
      scroll-snap-align: center;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-2);
      padding: 0 var(--space-2) var(--space-3);
      background: none;
      border: 0;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
    }
    .tl__stop:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 50%;
      width: 100%;
      top: 21px;
      height: 2px;
      background: linear-gradient(90deg, var(--olive), var(--gold));
      opacity: 0.5;
    }
    .tl__dot {
      position: relative;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--surface-2);
      border: 2px solid var(--border-strong);
      transition: all var(--dur) var(--ease);
    }
    .tl__period {
      font-size: var(--fs-xs);
      color: var(--gold-text);
    }
    .tl__label {
      font-weight: 600;
      font-size: var(--fs-sm);
    }
    .tl__stop:hover .tl__dot {
      border-color: var(--olive);
    }
    .tl__stop[aria-selected='true'] {
      color: var(--text);
    }
    .tl__stop[aria-selected='true'] .tl__dot {
      background: var(--olive-strong);
      border-color: var(--gold);
      color: var(--on-accent);
      transform: scale(1.1);
    }
    .tl__quote {
      margin: var(--space-4) 0;
      padding-left: var(--space-4);
      border-left: 3px solid var(--gold);
      font-style: italic;
      color: var(--text-muted);
    }
    .tl__count {
      font-size: var(--fs-xs);
      align-self: center;
    }
    .prose {
      max-width: 820px;
    }
    .tl__panel {
      animation: pop-in var(--dur) var(--ease);
      max-width: 820px;
    }
  `,
})
export class RegimentPage {
  protected readonly c = content;
  protected readonly active = signal(0);
  protected readonly current = computed(() => this.c.timeline[this.active()]);

  constructor() {
    inject(SeoService).set({
      title: 'Le 501st PIR',
      description: "L'histoire du 501st Parachute Infantry Regiment de 1942 à 1945 : Toccoa, la Normandie, la Hollande, Bastogne, l'Alsace et la devise Geronimo.",
      path: '/communaute/regiment',
    });
  }

  select(i: number) {
    this.active.set(i);
    document.getElementById(`tab-${i}`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  move(delta: number) {
    const next = Math.max(0, Math.min(this.c.timeline.length - 1, this.active() + delta));
    this.select(next);
    document.getElementById(`tab-${next}`)?.focus({ preventScroll: true });
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') this.move(1);
    else if (e.key === 'ArrowLeft') this.move(-1);
    else return;
    e.preventDefault();
  }
}
