import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import content from '../../../content/rejoindre.json';
import { TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { IconComponent } from '../../shared/icon.component';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-join-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent, BreadcrumbComponent, RevealDirective],
  template: `
    <div class="container">
      <header class="page-header">
        <app-breadcrumb [items]="[{ label: 'Rejoindre' }]" />
        <p class="eyebrow" style="margin-top: var(--space-5)">Recrutement ouvert</p>
        <h1>Rejoindre la 501e</h1>
        <p>{{ c.intro }}</p>
        @if (invitation() === 'indisponible') {
          <div class="alert alert--warning" role="alert">
            <app-icon name="alert-triangle" [size]="18" />
            <span>Le lien d'invitation n'est pas encore configuré. Contacte un membre de l'état-major.</span>
          </div>
        }
      </header>

      <ol class="join-steps">
        @for (s of c.steps; track s.title; let i = $index) {
          <li class="card" [appReveal]="i * 60">
            <div class="join-steps__num mono">Étape {{ i + 1 }}</div>
            <div class="card__icon"><app-icon [name]="s.icon" [size]="22" /></div>
            <h2>{{ s.title }}</h2>
            <p class="muted">{{ s.text }}</p>
            <ul>
              @for (it of s.items; track it) {
                <li><app-icon name="check" [size]="14" /> {{ it }}</li>
              }
            </ul>
          </li>
        }
      </ol>

      <div class="join-cta" appReveal>
        <div>
          <h2>Prêt ?</h2>
          <p class="muted">Le bouton t'emmène directement sur notre serveur Discord.</p>
        </div>
        <a class="btn btn--gold btn--lg" href="/api/join" rel="nofollow">
          <app-icon name="message" [size]="18" /> {{ 'cta.join' | t }}
        </a>
      </div>

      <section class="section section--tight container--narrow" aria-labelledby="faq-j">
        <h2 id="faq-j">Questions fréquentes</h2>
        @for (f of c.faq; track f.q) {
          <details class="card" style="margin-bottom: var(--space-3)">
            <summary style="cursor: pointer; font-weight: 600">{{ f.q }}</summary>
            <p class="muted" style="margin: var(--space-3) 0 0">{{ f.a }}</p>
          </details>
        }
      </section>
    </div>
  `,
  styles: `
    .join-steps {
      list-style: none;
      padding: 0;
      margin: 0 0 var(--space-7);
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
    }
    .join-steps h2 {
      font-size: var(--fs-lg);
      text-transform: none;
    }
    .join-steps__num {
      font-size: var(--fs-xs);
      color: var(--gold-text);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: var(--space-3);
    }
    .join-steps ul {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: var(--fs-sm);
    }
    .join-steps ul li {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      color: var(--text-muted);
    }
    .join-steps ul app-icon {
      color: var(--olive-text);
    }
    .join-cta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-5);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      border: 1px solid rgb(var(--gold-rgb) / 0.35);
      background: radial-gradient(ellipse at 100% 0%, rgb(var(--gold-rgb) / 0.14), transparent 60%), var(--surface-1);
    }
    .join-cta h2 {
      margin-bottom: var(--space-1);
    }
    .join-cta p {
      margin: 0;
    }
  `,
})
export class JoinPage {
  protected readonly c = content;
  readonly invitation = input<string>();
  constructor() {
    inject(SeoService).set({
      title: 'Rejoindre la 501e',
      description: 'Prérequis, installation de Squad 44, arrivée sur Discord, entretien et formation initiale : comment rejoindre la 501e.',
      path: '/rejoindre',
    });
  }
}
