import { Component, inject, OnInit } from '@angular/core';

import {
  DataTable,
  type DataTableColumn
} from '../../shared/components/data-table/data-table';

import { StockMovement } from './stock-movement.model';
import { StockMovementsApi } from './services/stock-movements-api';
import { AsyncPipe, CommonModule } from '@angular/common';
import { StockMovementCreate } from './stock-movement-create/stock-movement-create';

@Component({
  selector: 'app-stock-movements-page',
  imports: [AsyncPipe, DataTable, CommonModule, StockMovementCreate], 
  templateUrl: './stock-movements.html',
})
export class StockMovementsPage implements OnInit {
  private readonly stockMovementsApi = inject(StockMovementsApi);

  isCreateModalOpen = false;

  readonly movements$ = this.stockMovementsApi.movements$;
  readonly columns: DataTableColumn[] = [
    { key: 'date', label: 'Date' },
    { key: 'productName', label: 'Produit' },
    { key: 'type', label: 'Type' },
    { key: 'quantity', label: 'Quantité' },
    { key: 'warehouseName', label: 'Entrepôt' },
    { key: 'notes', label: 'Notes' },
  ];

  ngOnInit(): void {
    this.stockMovementsApi.getAll().subscribe();
  }

  addMovement(): void {
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }
}
