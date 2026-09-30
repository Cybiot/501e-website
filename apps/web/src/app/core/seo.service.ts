import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { t } from './i18n';

/** URL publique du site (balises canoniques et Open Graph). */
export const PUBLIC_URL = new InjectionToken<string>('PUBLIC_URL');

interface SeoInput {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'profile' | 'article';
  noindex?: boolean;
}

/** Titre, description, Open Graph (aperçu Discord soigné) et canonique. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly baseUrl = (inject(PUBLIC_URL, { optional: true }) ?? '').replace(/\/$/, '');

  set(input: SeoInput) {
    const siteName = t('site.name');
    const fullTitle = input.title === siteName ? siteName : `${input.title} · ${siteName}`;
    const description = input.description ?? t('site.description');
    const url = `${this.baseUrl}${input.path ?? ''}`;
    const image = input.image?.startsWith('http') ? input.image : `${this.baseUrl}${input.image ?? '/og-image.png'}`;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: input.noindex ? 'noindex, nofollow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });
    this.meta.updateTag({ property: 'og:locale', content: 'fr_FR' });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: input.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = url;
  }
}
