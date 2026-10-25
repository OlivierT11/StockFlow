import { Component, input } from '@angular/core';

/** Symbols of public/icons.svg (ported from the React app's sprite). */
export type IconName =
  | 'dashboard' | 'package' | 'moves' | 'tag' | 'warehouse' | 'users' | 'logout' | 'search' | 'plus'
  | 'eye' | 'eye-off' | 'pencil' | 'trash' | 'chevron-left' | 'chevron-right' | 'chevron-down'
  | 'arrow-up' | 'arrow-right' | 'arrow-in' | 'arrow-out' | 'sliders' | 'x' | 'check' | 'check-circle'
  | 'alert' | 'alert-circle' | 'info' | 'menu' | 'download' | 'filter' | 'inbox' | 'lock' | 'history'
  | 'euro' | 'calendar' | 'user' | 'refresh' | 'more' | 'shield';

/**
 * Decorative icon: `<app-icon name="plus" />`. The accessible name comes from the surrounding control.
 *
 * LEARN(A2) : le plus petit composant utile : un sélecteur, un template, un input().
 * LEARN(A3) : `[attr.href]` est un binding d'*attribut*. Les attributs SVG n'ont pas de propriété DOM
 * correspondante, donc le property binding habituel `[href]` ne fonctionnerait pas ici.
 */
@Component({
  selector: 'app-icon',
  template: `<svg class="od-icon" aria-hidden="true" focusable="false"><use [attr.href]="'icons.svg#i-' + name()" /></svg>`,
  // LEARN(A3) : `:host` cible l'élément du composant lui-même (<app-icon>). `display: contents` retire sa
  // boîte de la mise en page : le <svg> se place directement dans la flexbox du bouton.
  styles: `:host { display: contents; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
}
