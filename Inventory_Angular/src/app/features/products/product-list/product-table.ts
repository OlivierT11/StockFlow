import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, ProductSort, SortDirection } from '../../../core/api/api-models';
import { StockBadge } from '../../../shared/inventory/stock-badge';
import { Icon } from '../../../shared/ui/icon';

/**
 * The products table. Presentational (step B3): it gets the rows and the current sort through inputs,
 * and only *reports* clicks through outputs. ProductsPage, its container, decides what they do.
 */
@Component({
  selector: 'app-product-table',
  imports: [RouterLink, CurrencyPipe, DecimalPipe, StockBadge, Icon],
  templateUrl: './product-table.html',
})
export class ProductTable {
  readonly products = input.required<Product[]>();
  readonly sortBy = input.required<ProductSort>();
  readonly sortDirection = input.required<SortDirection>();
  readonly isAdmin = input(false);

  readonly sortChange = output<ProductSort>();
  readonly deleteRequest = output<Product>();

  protected ariaSort(key: ProductSort): string {
    if (this.sortBy() !== key) return 'none';
    return this.sortDirection() === 'desc' ? 'descending' : 'ascending';
  }
}
