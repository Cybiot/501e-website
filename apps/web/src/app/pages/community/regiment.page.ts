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
              (click)="active.set(i)"
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
            <p>{{ e.text }}</p>
            <div class="row">
              <button type="button" class="btn btn--sm" (click)="move(-1)" [disabled]="active() === 0">
                <app-icon name="chevron-left" [size]="16" /> Précédent
              </button>
              <button type="button" class="btn btn--sm" (click)="move(1)" [disabled]="active() === c.timeline.length - 1">
                Suivant <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          </article>
        }
      </section>

      <section class="section section--tight" aria-labelledby="src-title">
        <h2 id="src-title">Sources et crédits</h2>
        <ul class="muted">
          @for (s of c.sources; track s) {
            <li>{{ s }}</li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    .tl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--space-2);
      position: relative;
      margin-bottom: var(--space-5);
    }
    @media (min-width: 900px) {
      .tl::before {
        content: '';
        position: absolute;
        left: 8%;
        right: 8%;
        top: 21px;
        height: 2px;
        background: linear-gradient(90deg, var(--olive), var(--gold));
        opacity: 0.5;
      }
    }
    .tl__stop {
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
    .tl__dot {
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
      description: 'Le contexte historique du 501st Parachute Infantry Regiment : frise chronologique de la Normandie à Bastogne.',
      path: '/communaute/regiment',
    });
  }

  move(delta: number) {
    const next = Math.max(0, Math.min(this.c.timeline.length - 1, this.active() + delta));
    this.active.set(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') this.move(1);
    else if (e.key === 'ArrowLeft') this.move(-1);
    else return;
    e.preventDefault();
  }
}
