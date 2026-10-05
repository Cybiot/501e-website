import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';
import { RevealDirective } from './reveal.directive';

export interface Value {
  icon: string;
  title: string;
  text: string;
}

/**
 * Valeurs de la communauté : insignes centrés séparés par des filets.
 * Utilisée sur l'accueil et la page « La communauté ».
 */
@Component({
  selector: 'app-values-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RevealDirective],
  template: `
    <ul class="values__list">
      @for (v of values(); track v.title; let i = $index) {
        <li class="value" [appReveal]="i * 80">
          <span class="value__badge"><app-icon [name]="v.icon" [size]="26" /></span>
          <h3>{{ v.title }}</h3>
          <p class="muted">{{ v.text }}</p>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .values__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .value {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-5) var(--space-6);
    }
    .value + .value {
      border-left: 1px solid var(--border);
    }
    .value__badge {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: var(--gold-text);
      background: var(--gold-soft);
      border: 1px solid rgb(var(--gold-rgb) / 0.5);
      box-shadow:
        0 0 0 5px var(--bg),
        0 0 0 6px rgb(var(--gold-rgb) / 0.25);
      margin-bottom: var(--space-4);
    }
    .value h3 {
      font-family: var(--font-display);
      font-size: var(--fs-xl);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0;
    }
    .value h3::after {
      content: '';
      display: block;
      width: 32px;
      height: 2px;
      margin: var(--space-3) auto;
      background: var(--gold);
    }
    .value p {
      margin: 0;
      max-width: 32ch;
    }
    /* Empilées sur mobile : filets horizontaux au lieu de verticaux. */
    @media (max-width: 799px) {
      .values__list {
        grid-template-columns: 1fr;
      }
      .value + .value {
        border-left: 0;
        border-top: 1px solid var(--border);
      }
    }
  `,
})
export class ValuesListComponent {
  readonly values = input.required<Value[]>();
}
