import { Component, inject } from '@angular/core';
import { PageHead } from '../../shared/ui/page-head';
import { MovementsApi } from './movements-api';

/**
 * EXERCICE (B4 → C1) : le journal de tous les mouvements de stock, filtré par entrepôt et par période, paginé.
 * Même architecture que ProductsPage : l'URL porte les filtres, une ressource charge la page. Construis-la dans
 * l'ordre :
 *
 * TODO(B5) : des inputs pour les query params `entrepot`, `du`, `au` (dates "AAAA-MM-JJ") et `page`,
 *           et un computed() qui les transforme en MovementQuery (pageSize 25). Pour la période, `from` est le
 *           début du jour "du" et `to` le début du jour SUIVANT "au" (to est exclu), tous deux en chaînes ISO :
 *           new Date(`${du}T00:00`).toISOString().
 * TODO(B4) : implémente MovementsApi.list(), puis une rxResource sur cette requête.
 * TODO(A2) : le tableau (Date | apiDate, Produit en lien, badge de Type, Quantité m.delta | signedQty, Entrepôt,
 *           Notes), un <app-empty-state> quand il est vide, et <app-pagination>.
 * TODO(B6) : la barre de filtres : un <select> d'entrepôt (WarehousesApi.list) et deux <input type="date">,
 *           chacun appliquant sa valeur à l'URL comme ProductsPage.apply().
 * Bonus (C2) : un bouton "Nouveau mouvement" qui ouvre un formulaire de mouvement où l'on choisit le produit dans
 * un select.
 */
@Component({
  selector: 'app-movements-page',
  imports: [PageHead],
  template: `
    <app-page-head title="Mouvements" lede="Journal des entrées, sorties et ajustements de stock." />
    <section class="card"><p class="card-body muted">À implémenter — voir les TODO de movements-page.ts.</p></section>
  `,
})
export class MovementsPage {
  private readonly api = inject(MovementsApi);
}
