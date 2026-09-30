import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { TPipe } from './core/i18n';
import { ConsentModalComponent } from './layout/consent-modal.component';
import { FooterComponent } from './layout/footer.component';
import { HeaderComponent } from './layout/header.component';
import { ToastsComponent } from './layout/toasts.component';
import { IconComponent } from './shared/icon.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, HeaderComponent, FooterComponent, ToastsComponent, ConsentModalComponent, TPipe, IconComponent],
  template: `
    <a class="skip-link" href="#contenu">{{ 'nav.skip' | t }}</a>
    <app-header />
    @if (auth.isOutsider()) {
      <!-- Connecté via Discord mais sans rôle membre : traité comme un visiteur. -->
      <div class="outsider-banner" role="status">
        <div class="container row">
          <app-icon name="info" [size]="16" />
          <span>{{ 'outsider.banner' | t }}</span>
          <a routerLink="/rejoindre">{{ 'outsider.link' | t }}</a>
        </div>
      </div>
    }
    <main id="contenu" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
    <app-toasts />
    @if (auth.consentRequired()) {
      <app-consent-modal />
    }
  `,
  styles: `
    main {
      min-height: 60vh;
      outline: none;
    }
    .outsider-banner {
      background: var(--gold-soft);
      border-bottom: 1px solid rgb(var(--gold-rgb) / 0.3);
      padding-block: var(--space-2);
      font-size: var(--fs-sm);
      color: var(--gold-text);
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);

  constructor() {
    void this.auth.load();
  }
}
