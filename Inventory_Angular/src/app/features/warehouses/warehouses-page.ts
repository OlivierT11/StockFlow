import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth-service';
import { ErrorBanner } from '../../shared/ui/error-banner';
import { PageHead } from '../../shared/ui/page-head';
import { WarehousesApi } from './warehouses-api';

/**
 * EXERCICE (B2 → C2) : refais features/categories/categories-page pour les entrepôts, une étape à la fois.
 *
 * TODO(B4) : implémente WarehousesApi.list() ; la liste ci-dessous affiche alors les noms.
 * TODO(A2) : un tableau avec les colonnes Nom, Adresse ("—" si null) et les actions d'administration ;
 *           un <app-empty-state> quand il est vide.
 * TODO(C2) : une modale de création / modification avec un FormGroup de deux contrôles :
 *           name (requis, maxLength 100) et address (facultatif, maxLength 250).
 * TODO(B3) : la suppression avec une modale de confirmation, un toast, puis warehouses.reload().
 *           L'API refuse de supprimer un entrepôt qui a des mouvements (409) : affiche son message dans un toast.
 */
@Component({
  selector: 'app-warehouses-page',
  imports: [PageHead, ErrorBanner],
  templateUrl: './warehouses-page.html',
})
export class WarehousesPage {
  private readonly api = inject(WarehousesApi);
  protected readonly auth = inject(AuthService);

  protected readonly warehouses = rxResource({ stream: () => this.api.list() });
}
