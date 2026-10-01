import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Logo officiel de la communauté (source : assets/logo/501e.png).
 * Variantes détourées générées par apps/web/scripts/generate-assets.mjs dans /logo/.
 * `size` fixe la largeur en pixels CSS, la hauteur suit le ratio du logo.
 */
const RATIO = 538 / 512;

@Component({
  selector: 'app-insignia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-block;line-height:0' },
  template: `
    <img
      src="/logo/501e-256.webp"
      srcset="/logo/501e-128.webp 128w, /logo/501e-256.webp 256w, /logo/501e-512.webp 512w"
      [attr.sizes]="size() + 'px'"
      [width]="size()"
      [height]="height()"
      [alt]="label()"
      decoding="async"
    />
  `,
})
export class InsigniaComponent {
  readonly size = input(48);
  readonly label = input('Logo du 501st PIR');
  protected readonly height = computed(() => Math.round(this.size() * RATIO));
}
