import { Directive, ElementRef, afterEveryRender, inject } from '@angular/core';

/**
 * Recopie le texte affiché par un champ dans son attribut title : un contenu tronqué
 * (nom long, rôle Discord, description) se lit en entier au survol. Pour une liste
 * déroulante, c'est le libellé de l'option choisie. Mis à jour après chaque rendu
 * (saisie, chargement des options, rechargement des données).
 */
@Directive({
  selector: 'input.input:not([type=number]), select.select',
})
export class ValueTitleDirective {
  private readonly el = inject<ElementRef<HTMLInputElement | HTMLSelectElement>>(ElementRef).nativeElement;

  constructor() {
    afterEveryRender({ read: () => this.update() });
  }

  private update() {
    const el = this.el;
    const text = el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? '') : el.value;
    const title = text.trim();
    if (el.title !== title) el.title = title;
  }
}
