import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DataTable,
  type DataTableColumn
} from '../../shared/components/data-table/data-table';

import { StockMovement } from './stock-movement.model';
import { StockMovementsApi } from './stock-movements-api';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-stock-movements-page',
  imports: [AsyncPipe, DataTable], 
  templateUrl: './stock-movements.page.html',
})
export class StockMovementsPage {
  private readonly stockMovementsApi = inject(StockMovementsApi);
  readonly movements$: Observable<StockMovement[]> = this.stockMovementsApi.getAll();
  readonly columns: DataTableColumn[] = [
    { key: 'occurredAt', label: 'Date' },
    { key: 'productName', label: 'Produit' },
    { key: 'sku', label: 'Référence' },
    { key: 'type', label: 'Type' },
    { key: 'quantity', label: 'Quantité' },
    { key: 'warehouseName', label: 'Entrepôt' },
    { key: 'reference', label: 'Document' },
  ];
}
