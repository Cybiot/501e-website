import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../core/i18n';
import { IconComponent } from '../shared/icon.component';
import { InsigniaComponent } from '../shared/insignia.component';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TPipe, InsigniaComponent, IconComponent],
  template: `
    <footer class="footer">
      <div class="container footer__grid">
        <div class="footer__brand">
          <app-insignia [size]="44" label="" />
          <div>
            <strong>{{ 'site.fullName' | t }}</strong>
            <p class="muted small">{{ 'site.tagline' | t }}</p>
          </div>
        </div>
        <nav aria-label="Pied de page">
          <h2 class="footer__title">La 501e</h2>
          <ul>
            <li><a routerLink="/communaute">{{ 'nav.community' | t }}</a></li>
            <li><a routerLink="/communaute/regiment">{{ 'nav.regiment' | t }}</a></li>
            <li><a routerLink="/membres">{{ 'nav.members' | t }}</a></li>
            <li><a routerLink="/rejoindre">{{ 'nav.join' | t }}</a></li>
          </ul>
        </nav>
        <nav aria-label="Informations légales">
          <h2 class="footer__title">Informations</h2>
          <ul>
            <li><a routerLink="/mentions-legales">{{ 'footer.legal' | t }}</a></li>
            <li><a routerLink="/confidentialite">{{ 'footer.privacy' | t }}</a></li>
            <li><a routerLink="/cookies">{{ 'footer.cookies' | t }}</a></li>
          </ul>
        </nav>
        <div>
          <h2 class="footer__title">Nous rejoindre</h2>
          <p class="small muted">Recrutement ouvert à tous les joueurs francophones majeurs motivés par le RP.</p>
          <a class="btn btn--primary btn--sm" href="/api/join" rel="nofollow">
            <app-icon name="message" [size]="16" /> {{ 'cta.join' | t }}
          </a>
        </div>
      </div>
      <div class="container footer__bottom">
        <p class="small muted">{{ 'footer.disclaimer' | t }}</p>
        <p class="small muted"><app-icon name="shield" [size]="14" /> {{ 'footer.cookiesNote' | t }}</p>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      margin-top: var(--space-9);
      border-top: 1px solid var(--border);
      background: var(--surface-1);
      padding-top: var(--space-7);
    }
    .footer__grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: 1fr;
    }
    @media (min-width: 720px) {
      .footer__grid {
        grid-template-columns: 1.4fr 1fr 1fr 1.3fr;
      }
    }
    .footer__brand {
      display: flex;
      gap: var(--space-4);
      align-items: flex-start;
    }
    .footer__brand strong {
      font-family: var(--font-display);
      letter-spacing: -0.01em;
    }
    .footer__title {
      font-family: var(--font-mono);
      font-size: var(--fs-xs);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--gold-text);
      margin-bottom: var(--space-3);
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      margin-bottom: var(--space-2);
    }
    li a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: var(--fs-sm);
    }
    li a:hover {
      color: var(--text);
    }
    .footer__bottom {
      margin-top: var(--space-7);
      padding-block: var(--space-5);
      border-top: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-6);
      justify-content: space-between;
    }
    .footer__bottom p {
      margin: 0;
      max-width: 70ch;
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }
  `,
})
export class FooterComponent {}
