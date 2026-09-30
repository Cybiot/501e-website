import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberCard } from '../core/models';
import { AvatarComponent } from './avatar.component';

/**
 * Carte membre façon « plaque d'identité » (élément signature).
 * Utilisée dans la liste des membres, l'accueil et l'aperçu du profil.
 */
@Component({
  selector: 'app-dog-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent],
  template: `
    <article class="tag" [class.tag--static]="!link()">
      <span class="tag__hole" aria-hidden="true"></span>
      <div class="tag__head">
        <app-avatar [src]="member().avatarUrl" [name]="member().displayName" [size]="72" shape="square" [alt]="false" />
        <div class="tag__id">
          <h3 class="tag__name">
            @if (link()) {
              <a [routerLink]="['/membres', member().id]" class="tag__link">{{ member().displayName }}</a>
            } @else {
              {{ member().displayName }}
            }
          </h3>
          @if (member().rank; as rank) {
            <p class="tag__rank">
              @if (rank.iconUrl) {
                <img [src]="rank.iconUrl" alt="" width="18" height="18" />
              }
              <span>{{ rank.name }}</span>
            </p>
          } @else {
            <p class="tag__rank muted">Sans grade</p>
          }
        </div>
      </div>

      @if (member().tagline) {
        <p class="tag__quote">« {{ member().tagline }} »</p>
      }

      <div class="tag__foot">
        @if (visibleMedals().length) {
          <ul class="tag__medals" aria-label="Décorations">
            @for (m of visibleMedals(); track m.medal.id) {
              <li [title]="m.medal.name + (m.count > 1 ? ' ×' + m.count : '')">
                <img [src]="m.medal.imageUrl" [alt]="m.medal.name" width="28" height="28" loading="lazy" />
              </li>
            }
            @if (extraMedals() > 0) {
              <li class="tag__more" [attr.aria-label]="extraMedals() + ' autres médailles'">+{{ extraMedals() }}</li>
            }
          </ul>
        }
        @if (member().responsibilities.length) {
          <ul class="tag__resp" aria-label="Responsabilités">
            @for (r of member().responsibilities; track r.id) {
              <li class="badge badge--olive">{{ r.name }}</li>
            }
          </ul>
        }
      </div>
      <span class="tag__serial mono" aria-hidden="true">{{ serial() }}</span>
    </article>
  `,
  styles: `
    .tag {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-5) var(--space-4) var(--space-6);
      border-radius: 14px 38px 38px 14px;
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.06), transparent 40%),
        linear-gradient(180deg, var(--tag-top), var(--tag-bottom));
      border: 1px solid var(--tag-border);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), var(--shadow-1);
      transition: transform var(--dur) var(--ease), box-shadow var(--dur), border-color var(--dur);
    }
    .tag:not(.tag--static):hover,
    .tag:focus-within {
      transform: translateY(-3px) rotate(-0.4deg);
      border-color: var(--tag-border-hover);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), var(--shadow-2);
    }
    .tag__hole {
      position: absolute;
      left: 10px;
      top: 50%;
      width: 10px;
      height: 10px;
      margin-top: -5px;
      border-radius: 50%;
      background: var(--bg);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8), 0 0 0 1px var(--tag-border);
    }
    .tag__head {
      display: flex;
      gap: var(--space-4);
      align-items: center;
    }
    .tag__id {
      min-width: 0;
    }
    .tag__name {
      font-size: var(--fs-lg);
      margin: 0 0 var(--space-1);
      text-transform: none;
      overflow-wrap: anywhere;
    }
    .tag__link {
      color: var(--text);
      text-decoration: none;
    }
    /* Toute la carte est cliquable, le lien reste l'unique élément focusable. */
    .tag__link::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    .tag__rank {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--gold-text);
      font-weight: 600;
    }
    .tag__quote {
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--text-muted);
      font-style: italic;
    }
    .tag__foot {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .tag__medals,
    .tag__resp {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
    }
    .tag__medals img {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }
    .tag__more {
      min-width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      font-size: var(--fs-xs);
      font-weight: 700;
      color: var(--gold-text);
      border: 1px solid rgb(var(--gold-rgb) / 0.4);
      border-radius: 6px;
      padding: 0 4px;
    }
    .tag__serial {
      position: absolute;
      right: 22px;
      top: 12px;
      font-size: 10px;
      letter-spacing: 0.15em;
      color: var(--text-faint);
    }
  `,
})
export class DogTagComponent {
  readonly member = input.required<MemberCard>();
  readonly link = input(true);
  readonly maxMedals = input(3);
  protected readonly visibleMedals = computed(() => this.member().medals.slice(0, this.maxMedals()));
  protected readonly extraMedals = computed(() => this.member().medals.length - this.visibleMedals().length);
  /** Matricule décoratif stable dérivé de l'identifiant. */
  protected readonly serial = computed(() => {
    let h = 0;
    for (const c of this.member().id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `ASN ${String(h % 100000000).padStart(8, '0')}`;
  });
}
