import { Component, computed, input } from '@angular/core';
import { StockMovement } from '../../core/api/api-models';

interface ChartDay {
  /** "25/10" */
  label: string;
  in: number;
  out: number;
}

/**
 * Graphique en barres des quantités entrées et sorties par jour. Le tableau de bord doit le charger avec @defer
 * (étape C4).
 *
 * TODO(B2) : `days` = un computed() qui regroupe movements() par jour : un ChartDay par date, dans l'ordre des dates.
 *   In → ajoute m.quantity à `in` ; Out → ajoute m.quantity à `out` ; Adjustment est ignoré.
 *   Libellé : formatDate(utcDate, 'dd/MM', 'fr-FR') de @angular/common (voir ApiDatePipe pour la correction UTC).
 * TODO(A2) : dessine les barres dans le SVG avec @for sur days() : deux <rect> par jour (classe "bar-in" / "bar-out"),
 *   hauteur proportionnelle à valeur / max(), et le libellé du jour dans un <text>. Relie les attributs SVG avec
 *   [attr.height].
 */
@Component({
  selector: 'app-stock-chart',
  template: `
    <svg class="chart" viewBox="0 0 560 200" role="img" aria-label="Quantités entrées et sorties par jour">
      <text x="280" y="100" text-anchor="middle" fill="currentColor">{{ days().length }} jour(s) à afficher — TODO(A2)</text>
    </svg>
  `,
})
export class StockChart {
  readonly movements = input.required<StockMovement[]>();

  protected readonly days = computed<ChartDay[]>(() => []);
  protected readonly max = computed(() => Math.max(1, ...this.days().flatMap((d) => [d.in, d.out])));
}
