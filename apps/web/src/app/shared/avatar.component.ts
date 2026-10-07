import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Avatar avec repli : image approuvée → avatar Discord → initiales sur fond olive. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:inline-flex;flex-shrink:0' },
  template: `
    @if (src() && !failed()) {
      <img
        class="avatar"
        [src]="src()"
        [alt]="alt() ? 'Avatar de ' + name() : ''"
        [width]="size()"
        [height]="size()"
        [style.border-radius]="shape() === 'round' ? '50%' : '8px'"
        [style.width.px]="size()"
        [style.height.px]="size()"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="avatar avatar--initials"
        [attr.aria-hidden]="!alt()"
        [attr.aria-label]="alt() ? 'Avatar de ' + name() : null"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.38"
        [style.border-radius]="shape() === 'round' ? '50%' : '8px'"
        >{{ initials() }}</span
      >
    }
  `,
  styles: `
    .avatar--initials {
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, var(--olive-strong), var(--avatar-end));
      color: var(--on-accent);
      font-family: var(--font-display);
      font-weight: 600;
      letter-spacing: 0.04em;
    }
  `,
})
export class AvatarComponent {
  readonly src = input<string | null | undefined>(null);
  readonly name = input('');
  readonly size = input(40);
  readonly shape = input<'round' | 'square'>('round');
  readonly alt = input(true);
  protected readonly failed = signal(false);
  protected readonly initials = computed(() => initialsOf(this.name()));
}

/** Grade en tête de pseudo (« T/4. », « Lt.Col. »…), au cas où le préfixe n'a pas été retiré. */
const RANK_PREFIX = /^(?:Pvt|Pfc|Cpl|T\/[345]|Sgt|S\/Sgt|SSgt|Sfc|1\/Sgt|M\/Sgt|2Lt|1Lt|Lt|Cpt|Capt|Mjr|Maj|Lt\.?\s?Col|Col|Vet)\.?\s+/i;

/**
 * Initiales d'un pseudo « Grade Prénom(s) Nom "Surnom" » : première lettre du prénom et du nom de
 * famille (« T/4. Walter J. Cabezas "Actif" » → WC). Grade, surnom, initiales intermédiaires
 * et précisions entre parenthèses sont ignorés.
 */
export function initialsOf(name: string): string {
  const words = name
    .replace(/"[^"]*"|“[^”]*”|«[^»]*»|\([^)]*\)/g, ' ')
    .trim()
    .replace(RANK_PREFIX, '')
    .split(/\s+/)
    .filter((w) => w && !/^\p{L}\.?$/u.test(w));
  // Pseudo réduit à un surnom : on se rabat sur celui-ci.
  if (!words.length) return (name.match(/\p{L}/u)?.[0] ?? '?').toUpperCase();
  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0] : '';
  return (first + last).toUpperCase();
}
