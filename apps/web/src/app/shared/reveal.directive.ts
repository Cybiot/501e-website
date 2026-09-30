import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, Directive, ElementRef, inject, input, OnDestroy, PLATFORM_ID } from '@angular/core';

/**
 * Apparition douce au scroll. Le contenu reste visible sans JavaScript (SSR) :
 * la classe « reveal » n'est ajoutée que dans le navigateur, et ignorée si
 * l'utilisateur préfère réduire les animations.
 */
@Directive({ selector: '[appReveal]' })
export class RevealDirective implements OnDestroy {
  readonly delay = input(0, { alias: 'appReveal', transform: (v: unknown) => Number(v) || 0 });
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    afterNextRender(() => {
      const node = this.el.nativeElement;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
      const rect = node.getBoundingClientRect();
      if (rect.top < innerHeight) return; // déjà visible : pas d'effet (évite un « flash »)
      node.classList.add('reveal');
      node.style.transitionDelay = `${this.delay()}ms`;
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            node.classList.add('is-visible');
            this.observer?.disconnect();
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      );
      this.observer.observe(node);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
