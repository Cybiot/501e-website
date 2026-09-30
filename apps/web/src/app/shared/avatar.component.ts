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
  protected readonly initials = computed(() => {
    const cleaned = this.name()
      .replace(/[«»"()]/g, ' ')
      .replace(/\b(Pvt|Pfc|Cpl|Sgt|SSgt|Lt|Capt|Maj)\.?\s/gi, '')
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  });
}
