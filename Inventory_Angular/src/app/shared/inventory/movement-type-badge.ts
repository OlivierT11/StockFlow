import { Component, input } from '@angular/core';
import { MovementType } from '../../core/api/api-models';

/**
 * Badge of a stock movement type: `<app-movement-type-badge [type]="m.type" />`.
 *
 * TODO(A2) : affiche un badge par type avec @switch, comme le fait StockBadge :
 *   In         → classe "badge badge-in",     icône "arrow-in",  libellé "Entrée"
 *   Out        → classe "badge badge-sortie", icône "arrow-out", libellé "Sortie"
 *   Adjustment → classe "badge badge-adj",    icône "sliders",   libellé "Ajustement"
 * (importe Icon pour utiliser <app-icon>).
 *
 * TODO(A3) : écris ensuite une deuxième version sans @switch : un seul <span> dont les classes viennent d'un
 * objet de correspondance, avec un binding [class] (ou la directive ngClass), et compare les deux.
 */
@Component({
  selector: 'app-movement-type-badge',
  template: `<span class="badge">{{ type() }}</span>`,
})
export class MovementTypeBadge {
  readonly type = input.required<MovementType>();
}
