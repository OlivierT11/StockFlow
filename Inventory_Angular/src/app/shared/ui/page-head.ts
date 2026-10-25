import { Component, input } from '@angular/core';

/**
 * Title of a page, with optional breadcrumb and action buttons:
 *
 *   <app-page-head title="Produits" lede="42 produits">
 *     <nav crumbs>…</nav>
 *     <a actions class="btn btn-primary">Ajouter</a>
 *   </app-page-head>
 *
 * LEARN(A2) : projection de contenu à plusieurs emplacements. `<ng-content select="[actions]" />` ne prend que
 * les éléments projetés qui portent l'attribut `actions`.
 */
@Component({
  selector: 'app-page-head',
  template: `
    <div class="page-head">
      <div class="od-stack">
        <ng-content select="[crumbs]" />
        <h1>{{ title() }}</h1>
        @if (lede()) {
          <p class="lede">{{ lede() }}</p>
        }
      </div>
      <div class="page-actions"><ng-content select="[actions]" /></div>
    </div>
  `,
})
export class PageHead {
  readonly title = input.required<string>();
  readonly lede = input<string>();
}
