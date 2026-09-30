import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { t, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TPipe, IconComponent],
  template: `
    <div class="container" style="text-align: center; padding-block: var(--space-9)">
      <p class="stamp" style="margin-bottom: var(--space-5)">Erreur 500</p>
      <h1>{{ 'errors.serverTitle' | t }}</h1>
      <p class="muted">{{ 'errors.serverText' | t }}</p>
      <a class="btn btn--primary" routerLink="/"><app-icon name="home" [size]="16" /> {{ 'errors.backHome' | t }}</a>
    </div>
  `,
})
export class ErrorPage {
  constructor() {
    inject(SeoService).set({ title: t('errors.serverTitle'), noindex: true });
  }
}
