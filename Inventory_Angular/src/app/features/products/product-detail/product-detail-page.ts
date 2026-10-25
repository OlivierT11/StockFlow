import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject, input, numberAttribute, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth-service';
import { StockBadge } from '../../../shared/inventory/stock-badge';
import { ErrorBanner } from '../../../shared/ui/error-banner';
import { Icon } from '../../../shared/ui/icon';
import { PageHead } from '../../../shared/ui/page-head';
import { MovementForm } from '../../movements/movement-form';
import { ProductsApi } from '../products-api';

@Component({
  selector: 'app-product-detail-page',
  imports: [RouterLink, CurrencyPipe, DecimalPipe, PageHead, ErrorBanner, StockBadge, MovementForm, Icon],
  templateUrl: './product-detail-page.html',
})
export class ProductDetailPage {
  private readonly api = inject(ProductsApi);
  protected readonly auth = inject(AuthService);

  // LEARN(B5) : le paramètre de route :id, relié par withComponentInputBinding(). La fonction de transformation
  // numberAttribute convertit la chaîne "42" de l'URL en nombre 42.
  readonly id = input.required({ transform: numberAttribute });
  /** ?page= of the movement history. */
  readonly page = input<string>();

  // Reloads by itself when the id changes (navigation from one product to another reuses this component).
  protected readonly product = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });

  protected readonly showMovementForm = signal(false);

  // TODO(B4, B5) : l'historique des mouvements du produit, 8 par page :
  //   history = rxResource({ params: () => ({ id: this.id(), page: Number(this.page()) || 1 }),
  //                          stream: ({ params }) => this.api.movements(params.id, params.page, 8) })
  // puis remplis la carte "Historique des mouvements" du template (voir le TODO là-bas).

  protected onMovementSaved(): void {
    this.showMovementForm.set(false);
    // The stock changed: fetch the product again.
    this.product.reload();
  }
}
