import { Component, computed, input } from '@angular/core';
import { Product } from '../../core/api/api-models';
import { Icon } from '../ui/icon';
import { stockState } from './stock-state';

/** "Normal" / "Sous seuil" / "Rupture" badge of a product. */
@Component({
  selector: 'app-stock-badge',
  imports: [Icon],
  template: `
    <!-- LEARN(A2) : @switch affiche le premier @case qui correspond, sinon @default. -->
    @switch (state()) {
      @case ('out') {
        <span class="badge badge-out"><app-icon name="alert-circle" />Rupture</span>
      }
      @case ('low') {
        <span class="badge badge-low"><app-icon name="alert" />Sous seuil</span>
      }
      @default {
        <span class="badge badge-ok"><app-icon name="check" />Normal</span>
      }
    }
  `,
})
export class StockBadge {
  readonly product = input.required<Pick<Product, 'stock' | 'lowStockThreshold'>>();
  protected readonly state = computed(() => stockState(this.product()));
}
