import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import content from '../../../content/communaute.json';
import { TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { IconComponent } from '../../shared/icon.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { ValuesListComponent } from '../../shared/values-list.component';

@Component({
  selector: 'app-community-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TPipe, IconComponent, BreadcrumbComponent, RevealDirective, ValuesListComponent],
  template: `
    <div class="container">
      <header class="page-header">
        <app-breadcrumb [items]="[{ label: 'La communauté' }]" />
        <p class="eyebrow" style="margin-top: var(--space-5)">Qui sommes-nous</p>
        <h1>La communauté</h1>
        <p>{{ c.intro }}</p>
        <div class="row">
          <a class="btn btn--primary" href="/api/join" target="_blank" rel="nofollow noopener noreferrer"><app-icon name="message" [size]="16" /> {{ 'cta.join' | t }}</a>
          <a class="btn" routerLink="/communaute/regiment"><app-icon name="book" [size]="16" /> Le 501st PIR dans l'histoire</a>
        </div>
      </header>

      <section class="section section--tight" aria-labelledby="v-title">
        <h2 id="v-title">Nos valeurs</h2>
        <app-values-list [values]="c.values" />
      </section>

      <section class="section section--tight" aria-labelledby="g-title">
        <h2 id="g-title">{{ c.games.title }}</h2>
        <p class="muted">{{ c.games.text }}</p>
        <div class="games">
          @for (g of c.games.items; track g.name) {
            <div class="card game" appReveal>
              <app-icon name="gamepad" [size]="22" />
              <div>
                <h3>{{ g.name }} <span class="badge">{{ g.tag }}</span></h3>
                <p class="muted" style="margin: 0">{{ g.text }}</p>
              </div>
            </div>
          }
        </div>
      </section>

      <section class="section section--tight" aria-labelledby="s-title">
        <h2 id="s-title">{{ c.session.title }}</h2>
        <ol class="session">
          @for (s of c.session.steps; track s.time) {
            <li appReveal>
              <span class="session__time mono">{{ s.time }}</span>
              <div>
                <h3>{{ s.title }}</h3>
                <p class="muted">{{ s.text }}</p>
              </div>
            </li>
          }
        </ol>
        <p class="small muted">{{ c.session.note }}</p>
      </section>

      <section class="section section--tight" aria-labelledby="o-title">
        <h2 id="o-title">{{ c.organisation.title }}</h2>
        <p class="muted" style="max-width: 70ch">{{ c.organisation.text }}</p>
        <a class="card card--interactive staff" routerLink="/compagnies/etat-major" appReveal>
          <img src="/logo/compagnies/etat-major-160.webp" alt="" width="160" height="160" loading="lazy" />
          <div>
            <h3>{{ c.organisation.staff.name }}</h3>
            <p class="muted" style="margin: 0">{{ c.organisation.staff.text }}</p>
          </div>
        </a>

        <div class="card companies" appReveal>
          <div>
            <h3>{{ c.organisation.companies.title }}</h3>
            <p class="muted" style="margin: 0">{{ c.organisation.companies.text }}</p>
          </div>
          <a class="btn" routerLink="/compagnies">Découvrir les compagnies <app-icon name="arrow-right" [size]="16" /></a>
        </div>
      </section>

      <section class="section section--tight" aria-labelledby="r-title">
        <h2 id="r-title">{{ c.rules.title }}</h2>
        <ul class="rules">
          @for (r of c.rules.items; track r) {
            <li><app-icon name="check" [size]="18" /> <span>{{ r }}</span></li>
          }
        </ul>
        <p>
          <a class="btn" [href]="c.rules.fullRulesUrl" target="_blank" rel="noopener noreferrer">{{ c.rules.fullRulesLabel }}</a>
        </p>
      </section>
    </div>
  `,
  styles: `
    .session {
      list-style: none;
      padding: 0;
      margin: 0 0 var(--space-4);
      border-left: 2px solid var(--border-strong);
    }
    .session li {
      display: flex;
      gap: var(--space-5);
      padding: 0 0 var(--space-5) var(--space-5);
      position: relative;
    }
    .session li::before {
      content: '';
      position: absolute;
      left: -7px;
      top: 6px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--olive);
      box-shadow: 0 0 0 4px var(--bg);
    }
    .session__time {
      color: var(--gold-text);
      font-weight: 600;
      min-width: 3.5rem;
    }
    .session h3 {
      margin-bottom: var(--space-1);
    }
    .session p {
      margin: 0;
    }
    .games {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
      gap: var(--space-4);
    }
    .game {
      display: flex;
      gap: var(--space-4);
      align-items: flex-start;
    }
    .game app-icon {
      color: var(--gold-text);
      flex-shrink: 0;
      margin-top: 2px;
    }
    .game h3 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }
    .staff {
      color: inherit;
      text-decoration: none;
      display: flex;
      gap: var(--space-5);
      align-items: center;
      max-width: 80ch;
    }
    .staff img {
      width: 72px;
      height: auto;
      flex-shrink: 0;
    }
    .companies {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      align-items: center;
      justify-content: space-between;
      max-width: 80ch;
      margin-top: var(--space-4);
    }
    .companies > div {
      flex: 1 1 320px;
    }
    .rules {
      list-style: none;
      padding: 0;
      display: grid;
      gap: var(--space-3);
      max-width: 80ch;
    }
    .rules li {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
    }
    .rules app-icon {
      color: var(--olive-text);
      margin-top: 3px;
    }
  `,
})
export class CommunityPage {
  protected readonly c = content;
  constructor() {
    inject(SeoService).set({
      title: 'La communauté',
      description: 'Présentation, valeurs, jeux (Squad 44 et Squad), déroulement des sessions, organisation et règlement de la communauté 501e.',
      path: '/communaute',
    });
  }
}
