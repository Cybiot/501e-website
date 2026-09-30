import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Insigne du régiment — PLACEHOLDER SVG original (aigle stylisé sur écu).
 * À remplacer par le logo officiel de la communauté (fichier SVG libre de droits).
 * Couleurs tirées des tokens : l'insigne suit le thème (nuit / jour).
 */
@Component({
  selector: 'app-insignia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-block;line-height:0' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size() * 1.15"
      viewBox="0 0 100 115"
      role="img"
      [attr.aria-label]="label()"
    >
      <path
        d="M50 3 94 14v38c0 30-20 50-44 60C26 102 6 82 6 52V14Z"
        stroke-width="3"
        style="fill: var(--surface-1); stroke: var(--gold)"
      />
      <path
        d="M50 11 86 20v32c0 25-16 42-36 51C30 94 14 77 14 52V20Z"
        fill="none"
        stroke-width="1.5"
        style="stroke: var(--border)"
      />
      <!-- Aigle stylisé (géométrie originale) -->
      <path
        d="M50 30c-6 0-10 4-11 9l-9-4 4 8-9 1 9 6-4 6 10-2c2 5 6 8 10 9 4-1 8-4 10-9l10 2-4-6 9-6-9-1 4-8-9 4c-1-5-5-9-11-9Z"
        style="fill: var(--text)"
      />
      <circle cx="46" cy="41" r="1.8" style="fill: var(--surface-1)" />
      <path d="M50 44l6 3-6 2Z" style="fill: var(--olive)" />
      <text
        x="50"
        y="92"
        text-anchor="middle"
        font-size="14"
        font-weight="700"
        style="font-family: var(--font-display); fill: var(--gold)"
      >
        501
      </text>
    </svg>
  `,
})
export class InsigniaComponent {
  readonly size = input(48);
  readonly label = input('Insigne du 501st PIR');
}
