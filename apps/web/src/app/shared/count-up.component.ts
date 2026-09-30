import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, PLATFORM_ID, signal } from '@angular/core';

/** Chiffre clé animé au moment où il entre à l'écran (valeur finale rendue côté serveur). */
@Component({
  selector: 'app-count-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ display() }}`,
})
export class CountUpComponent {
  readonly value = input.required<number>();
  protected readonly display = signal(0);
  private readonly el = inject(ElementRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private animated = false;

  constructor() {
    effect(() => {
      // SSR et valeur mise à jour : on affiche directement la valeur finale.
      if (!this.browser || this.animated) this.display.set(this.value());
    });
    afterNextRender(() => {
      const target = this.value();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        this.animated = true;
        this.display.set(target);
        return;
      }
      this.display.set(0);
      const obs = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / 1200);
          this.display.set(Math.round(this.value() * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
          else this.animated = true;
        };
        requestAnimationFrame(step);
      });
      obs.observe(this.el.nativeElement);
    });
  }
}
