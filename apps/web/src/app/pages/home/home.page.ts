import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import content from '../../../content/accueil.json';
import { Api } from '../../core/api.service';
import { TPipe } from '../../core/i18n';
import { Featured } from '../../core/models';
import { SeoService } from '../../core/seo.service';
import { CountUpComponent } from '../../shared/count-up.component';
import { DogTagComponent } from '../../shared/dog-tag.component';
import { IconComponent } from '../../shared/icon.component';
import { InsigniaComponent } from '../../shared/insignia.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { DROP_SCENE, playDrop } from './drop-scene';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TPipe,
    IconComponent,
    InsigniaComponent,
    CountUpComponent,
    DogTagComponent,
    RevealDirective,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
})
export class HomePage {
  private readonly api = inject(Api);
  protected readonly c = content;
  protected readonly drop = DROP_SCENE;
  protected readonly dropReady = signal(false);
  private readonly dropEl = viewChild.required<ElementRef<HTMLElement>>('dropScene');
  protected readonly years = new Date().getFullYear() - content.stats.foundedYear;
  protected readonly stats = signal<{ members: number; medalsAwarded: number } | null>(null);
  protected readonly featured = signal<Featured[] | null>(null);
  protected readonly parallax = signal(0);

  constructor() {
    inject(SeoService).set({ title: '501st PIR', path: '/' });
    this.api
      .get<{ members: number; medalsAwarded: number }>('/stats')
      .then((s) => this.stats.set(s))
      .catch(() => this.stats.set({ members: 0, medalsAwarded: 0 }));
    this.api
      .get<Featured[]>('/members/featured')
      .then((f) => this.featured.set(f))
      .catch(() => this.featured.set([]));

    // Largage lancé une seule fois, après l'hydratation (scène finale directe si les animations sont réduites).
    afterNextRender(() => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        playDrop(this.dropEl().nativeElement);
      this.dropReady.set(true);
    });

    // Parallaxe légère sur le hero (désactivée si l'utilisateur réduit les animations).
    if (
      isPlatformBrowser(inject(PLATFORM_ID)) &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const onScroll = () => this.parallax.set(Math.min(window.scrollY, 800) * 0.25);
      window.addEventListener('scroll', onScroll, { passive: true });
      inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll));
    }
  }
}
