import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import companies from '../../../content/compagnies.json';
import content from '../../../content/communaute.json';
import { SeoService } from '../../core/seo.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';
import { IconComponent } from '../../shared/icon.component';
import { RevealDirective } from '../../shared/reveal.directive';

/** Les compagnies du régiment : une carte par compagnie, vers sa fiche (présentation et effectif). */
@Component({
  selector: 'app-companies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, BreadcrumbComponent, RevealDirective],
  template: `
    <div class="container">
      <header class="page-header">
        <app-breadcrumb [items]="[{ label: 'Les compagnies' }]" />
        <p class="eyebrow" style="margin-top: var(--space-5)">Organisation du régiment</p>
        <h1>Les compagnies</h1>
        <p>{{ intro }}</p>
      </header>

      <section class="section section--tight" aria-label="Liste des compagnies">
        <div class="grid" style="--min: 220px">
          @for (co of companies; track co.slug; let i = $index) {
            <a class="card card--interactive company" [routerLink]="['/compagnies', co.slug]" [appReveal]="i * 80">
              <img
                class="company__logo"
                [src]="'/logo/compagnies/' + co.slug + '-320.webp'"
                [srcset]="'/logo/compagnies/' + co.slug + '-160.webp 160w, /logo/compagnies/' + co.slug + '-320.webp 320w'"
                sizes="160px"
                alt=""
                width="160"
                height="160"
                loading="lazy"
              />
              <h2 class="company__name">{{ co.name }}</h2>
              <p class="company__unit mono small">{{ co.unit }}</p>
              <p class="company__motto small">« {{ co.motto }} »</p>
              <p class="muted small" style="margin: 0">{{ co.summary }}</p>
              <span class="company__more small">Voir la compagnie <app-icon name="arrow-right" [size]="14" /></span>
            </a>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .company {
      color: inherit;
      text-decoration: none;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .company__logo {
      width: 140px;
      height: 140px;
      object-fit: contain;
      margin-bottom: var(--space-4);
      filter: drop-shadow(0 6px 14px rgb(0 0 0 / 0.35));
    }
    .company__name {
      margin: 0 0 var(--space-1);
      font-size: var(--fs-lg);
    }
    .company__unit {
      color: var(--gold-text);
      margin: 0 0 var(--space-2);
    }
    .company__motto {
      font-style: italic;
      color: var(--text-muted);
      margin: 0 0 var(--space-3);
    }
    .company__more {
      margin-top: auto;
      padding-top: var(--space-4);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--olive-text);
      font-weight: 600;
    }
  `,
})
export class CompaniesPage {
  protected readonly companies = companies;
  protected readonly intro = content.organisation.companies.text;
  constructor() {
    inject(SeoService).set({
      title: 'Les compagnies',
      description: 'Les compagnies de la 501e : Steel Hawk, Blood Wall, Sledge Hammer et le camp Toccoa.',
      path: '/compagnies',
    });
  }
}
