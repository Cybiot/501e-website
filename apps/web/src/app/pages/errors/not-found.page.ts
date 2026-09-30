import { isPlatformServer } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { t, TPipe } from '../../core/i18n';
import { SeoService } from '../../core/seo.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TPipe, IconComponent],
  template: `
    <div class="container error-page">
      <p class="stamp">Erreur 404</p>
      <h1>{{ 'errors.notFoundTitle' | t }}</h1>
      <p class="muted">{{ 'errors.notFoundText' | t }}</p>
      <div class="row" style="justify-content: center">
        <a class="btn btn--primary" routerLink="/"><app-icon name="home" [size]="16" /> {{ 'errors.backHome' | t }}</a>
        <a class="btn" routerLink="/membres">{{ 'nav.members' | t }}</a>
      </div>
    </div>
  `,
  styles: `
    .error-page {
      text-align: center;
      padding-block: var(--space-9);
    }
    .stamp {
      margin-bottom: var(--space-5);
    }
  `,
})
export class NotFoundPage {
  constructor() {
    inject(SeoService).set({ title: t('errors.notFoundTitle'), noindex: true });
    const init = inject(RESPONSE_INIT, { optional: true });
    if (isPlatformServer(inject(PLATFORM_ID)) && init) init.status = 404;
  }
}
