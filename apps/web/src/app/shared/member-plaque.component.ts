import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberCard, medalLabel } from '../core/models';
import { AvatarComponent } from './avatar.component';

/**
 * Carte membre « fiche paysage » : avatar à gauche, informations à droite, sur un dégradé radial
 * grenu qui couvre toute la carte, cadre en corde dorée façon ruban de médaille.
 * - Nuit (défaut) : clair de lune, bleu nuit avec lueur cyan glacé au centre, texte clair.
 * - Jour : cuir patiné, or au centre → terracotta → cuivre → brun, texte à l'encre brune.
 * Hauteur fixe minimale (124 px, 152 px sous 440 px de large) ; sous 360 px, le médaillon se resserre.
 * Images : /visuels/plaque-corde.png (border-image) et /visuels/plaque-grain.png (grain tuilable).
 */
@Component({
  selector: 'app-member-plaque',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent],
  host: { class: 'plaque-host' },
  template: `
    <article class="plaque" [class.plaque--static]="!link()">
      <div class="plaque__medallion">
        <div class="plaque__portrait">
          <app-avatar
            [src]="member().avatarUrl"
            [name]="member().displayName"
            [size]="72"
            [alt]="false"
          />
        </div>
      </div>

      <div class="plaque__body">
        <h3 class="plaque__name">
          @if (member().rank; as rank) {
            @if (rank.iconUrl) {
              <img
                class="plaque__rank"
                [src]="rank.iconUrl"
                [alt]="rank.name"
                [title]="rank.name"
                width="24"
                height="24"
              />
            } @else {
              <span class="sr-only">{{ rank.name }} </span>
            }
          }
          @if (link()) {
            <a
              [routerLink]="['/membres', member().id]"
              class="plaque__link"
              [title]="member().displayName"
              >{{ member().displayName }}</a
            >
          } @else {
            <span class="plaque__link">{{ member().displayName }}</span>
          }
        </h3>

        @if (member().tagline) {
          <p class="plaque__quote" [title]="member().tagline">« {{ member().tagline }} »</p>
        }

        <div class="plaque__foot">
          <div class="plaque__row">
            @if (member().company; as co) {
              <img
                class="plaque__company"
                [src]="'/logo/compagnies/' + co.slug + '-160.webp'"
                [alt]="companyLabel()"
                [title]="companyLabel()"
                width="34"
                height="34"
                loading="lazy"
              />
            }
            @if (visibleMedals().length) {
              <ul class="plaque__medals" aria-label="Décorations">
                @for (m of visibleMedals(); track m.medal.id) {
                  <li [title]="label(m.medal) + (m.count > 1 ? ' ×' + m.count : '')">
                    <img
                      class="medal-img"
                      [src]="m.medal.imageUrl"
                      [alt]="label(m.medal)"
                      width="38"
                      height="15"
                      loading="lazy"
                    />
                  </li>
                }
                @if (extraMedals() > 0) {
                  <li class="plaque__more" [attr.aria-label]="extraMedals() + ' autres médailles'">
                    +{{ extraMedals() }}
                  </li>
                }
              </ul>
            }
          </div>
          @if (member().responsibilities.length) {
            <ul class="plaque__resp" aria-label="Responsabilités">
              @for (r of visibleResp(); track r.id) {
                <li [title]="r.name">{{ r.name }}</li>
              }
              @if (extraResp() > 0) {
                <li
                  class="plaque__more"
                  [attr.aria-label]="extraResp() + ' autres responsabilités'"
                >
                  +{{ extraResp() }}
                </li>
              }
            </ul>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
      height: 100%;
    }
    .plaque {
      /* Thème nuit (défaut) : clair de lune sur toile bleu nuit */
      --p-gold-text: #f2c66b;
      --p-cream: #f6e7c8;
      --p-ink: #f2f4ff;
      --p-ink-soft: #d4dbf7;
      --p-text-shadow: 0 1px 2px rgb(3 6 18 / 0.8);
      --p-chip-bg: rgb(7 11 26 / 0.72);
      --p-edge: #070b1a;
      --p-vignette: rgb(5 8 20 / 0.85);
      --p-avatar-a: #2c3876;
      --p-avatar-b: #0b1230;
      --p-grain: 0.7;
      --p-bg:
        radial-gradient(ellipse 42% 70% at 50% 46%, rgb(92 225 230 / 0.1), transparent 70%),
        radial-gradient(
          ellipse 100% 170% at 50% 50%,
          #4a64a2 0%,
          #405a98 14%,
          #34498a 30%,
          #283a73 46%,
          #1d2b5a 62%,
          #141f44 78%,
          #0c1430 91%,
          var(--p-edge) 100%
        );

      position: relative;
      isolation: isolate;
      /* Hauteur fixe et minimale : toutes les fiches de la grille s'alignent. Chaque élément
         tient sur une ligne (nom, devise, logo + médailles + responsabilité). */
      height: 124px;
      display: grid;
      grid-template-columns: 128px minmax(0, 1fr);
      color: var(--p-ink);
      border: 7px solid transparent;
      border-image: url('/visuels/plaque-corde.png') 24 / 7px round;
      background: var(--p-bg), var(--p-edge);
      /* Bords adoucis qui s'estompent sous le cadre */
      box-shadow:
        inset 0 0 32px 10px var(--p-vignette),
        inset 0 0 4px 1px rgb(0 0 0 / 0.6),
        0 12px 28px rgb(0 0 0 / 0.5);
      transition:
        transform var(--dur) var(--ease),
        box-shadow var(--dur);
    }
    /* Thème jour : cuir patiné, or chaud → terracotta → cuivre brûlé → brun profond */
    :host-context([data-theme='jour']) .plaque {
      --p-ink: #2b1409;
      --p-ink-soft: #2b1409;
      --p-text-shadow: 0 1px 0 rgb(255 228 165 / 0.35); /* texte estampé dans le cuir */
      --p-chip-bg: rgb(36 18 10 / 0.72);
      --p-edge: #22140d;
      --p-vignette: rgb(34 20 13 / 0.85);
      --p-avatar-a: #7a4424;
      --p-avatar-b: #24120a;
      --p-grain: 0.55;
      --p-bg: radial-gradient(
        ellipse 100% 170% at 50% 50%,
        #ffde80 0%,
        #fcc858 12%,
        #eaa046 26%,
        #ce743c 42%,
        #a6522a 60%,
        #72341c 78%,
        #402013 91%,
        var(--p-edge) 100%
      );
    }
    /* Grain fin et irrégulier (cuir patiné / sable) */
    .plaque::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: url('/visuels/plaque-grain.png') repeat;
      background-size: 160px;
      mix-blend-mode: overlay;
      opacity: var(--p-grain);
      pointer-events: none;
    }
    .plaque:not(.plaque--static):hover,
    .plaque:focus-within {
      transform: translateY(-3px);
      box-shadow:
        inset 0 0 32px 10px var(--p-vignette),
        inset 0 0 4px 1px rgb(0 0 0 / 0.6),
        0 18px 36px rgb(0 0 0 / 0.6);
    }

    .plaque__medallion {
      display: grid;
      place-items: center;
    }
    .plaque__portrait {
      display: inline-flex;
      border-radius: 50%;
      border: 2px solid #d9a63a;
      box-shadow:
        0 0 0 2px var(--p-avatar-b),
        0 4px 12px rgb(0 0 0 / 0.45);
      /* Avatar sans photo : monogramme or (variables reprises par app-avatar) */
      --olive-strong: var(--p-avatar-a);
      --avatar-end: var(--p-avatar-b);
      --on-accent: var(--p-gold-text);
    }
    .plaque__portrait :is(img, span) {
      display: block;
    }

    .plaque__body {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px var(--space-4) 10px var(--space-1);
      overflow: hidden;
      text-shadow: var(--p-text-shadow);
    }
    .plaque__company {
      width: 34px;
      height: 34px;
      object-fit: contain;
      flex-shrink: 0;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
    }
    .plaque__name {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: var(--fs-lg);
      line-height: 1.15;
      text-transform: none;
      color: var(--p-ink);
    }
    .plaque__link {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: inherit;
      text-decoration: none;
    }
    /* Toute la carte est cliquable, le lien reste l'unique élément focusable. */
    .plaque__link::after {
      content: '';
      position: absolute;
      inset: -7px;
    }
    .plaque__link:focus-visible {
      outline: none;
    }
    .plaque:has(.plaque__link:focus-visible) {
      outline: 3px solid var(--p-gold-text);
      outline-offset: 4px;
    }
    .plaque__rank {
      width: 24px;
      height: 24px;
      object-fit: contain;
      flex-shrink: 0;
      filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.6));
    }
    .plaque__quote {
      flex-shrink: 0;
      margin: 0;
      color: var(--p-ink-soft);
      font-size: var(--fs-sm);
      font-style: italic;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      line-clamp: 1;
      overflow: hidden;
    }
    .plaque__foot {
      margin-top: auto;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 6px var(--space-3);
      min-width: 0;
    }
    /* Logo de compagnie et médailles toujours côte à côte */
    .plaque__row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }
    .plaque__medals,
    .plaque__resp {
      min-width: 0;
      overflow: hidden;
      list-style: none;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
    }
    .plaque__medals li {
      display: flex;
      flex-shrink: 0;
    }
    .plaque__medals img {
      width: 38px;
      height: 22px;
      object-fit: contain;
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
    }
    .plaque__more {
      flex-shrink: 0;
      min-width: 28px;
      height: 20px;
      display: grid;
      place-items: center;
      padding: 0 5px;
      font-size: var(--fs-xs);
      font-weight: 700;
      color: var(--p-gold-text);
      text-shadow: none;
      background: var(--p-chip-bg);
      border: 1px solid rgb(242 198 107 / 0.6);
      border-radius: 4px;
    }
    .plaque__resp li:not(.plaque__more) {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 2px 10px;
      font-size: var(--fs-xs);
      font-weight: 500;
      color: var(--p-cream);
      text-shadow: none;
      background: var(--p-chip-bg);
      border: 1px solid rgb(217 166 58 / 0.7);
      border-radius: 999px;
    }

    /* Fiche moyenne : la responsabilité passe sous les médailles. */
    @container (max-width: 439px) {
      .plaque {
        height: 152px;
      }
      .plaque__foot {
        flex-wrap: wrap;
      }
    }

    /* Fiche étroite : reste en paysage, médaillon resserré. */
    @container (max-width: 359px) {
      .plaque {
        grid-template-columns: 92px minmax(0, 1fr);
      }
      .plaque__portrait {
        zoom: 0.78;
      }
      .plaque__body {
        padding-left: 0;
        padding-right: var(--space-3);
      }
      .plaque__name {
        font-size: var(--fs-md);
      }
      .plaque__company {
        width: 26px;
        height: 26px;
      }
      .plaque__row,
      .plaque__medals {
        gap: var(--space-1);
      }
      .plaque__medals img {
        width: 28px;
        height: 18px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .plaque {
        transition: none;
      }
      .plaque:not(.plaque--static):hover,
      .plaque:focus-within {
        transform: none;
      }
    }
  `,
})
export class MemberPlaqueComponent {
  readonly member = input.required<MemberCard>();
  readonly link = input(true);
  readonly maxMedals = input(3);
  protected readonly label = medalLabel;
  protected readonly visibleMedals = computed(() =>
    this.member().medals.slice(0, this.maxMedals()),
  );
  /** Nom de la compagnie (et section) : texte alternatif du logo, seul porteur de l'information. */
  protected readonly companyLabel = computed(() => {
    const co = this.member().company;
    return co ? co.name + (co.platoon ? ' · ' + co.platoon : '') : '';
  });
  protected readonly extraMedals = computed(
    () => this.member().medals.length - this.visibleMedals().length,
  );
  protected readonly visibleResp = computed(() => this.member().responsibilities.slice(0, 1));
  protected readonly extraResp = computed(
    () => this.member().responsibilities.length - this.visibleResp().length,
  );
}
