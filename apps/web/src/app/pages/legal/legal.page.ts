import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import confidentialite from '../../../content/legal/confidentialite.md';
import cookies from '../../../content/legal/cookies.md';
import { SeoService } from '../../core/seo.service';
import { BreadcrumbComponent } from '../../shared/breadcrumb.component';

const DOCS: Record<string, { md: string; title: string; path: string }> = {
  confidentialite: { md: confidentialite, title: 'Politique de confidentialité', path: '/confidentialite' },
  cookies: { md: cookies, title: 'Politique cookies', path: '/cookies' },
};

/** Pages légales rédigées en Markdown (src/content/legal/*.md). */
@Component({
  selector: 'app-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbComponent],
  template: `
    <div class="container">
      <div class="page-header" style="padding-bottom: 0">
        <app-breadcrumb [items]="[{ label: current().title }]" />
      </div>
      <article class="prose section--tight" [innerHTML]="html()"></article>
    </div>
  `,
})
export class LegalPage {
  private readonly seo = inject(SeoService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly doc = input<string>('confidentialite');
  protected readonly current = computed(() => DOCS[this.doc()] ?? DOCS['confidentialite']!);

  constructor() {
    effect(() => this.seo.set({ title: this.current().title, path: this.current().path }));
  }

  // Contenu versionné dans le dépôt (source de confiance) converti en HTML.
  protected readonly html = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(marked.parse(this.current().md, { async: false })),
  );
}
