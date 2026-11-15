import { Component, inject, OnInit } from '@angular/core';

import {
  DataTable,
  type DataTableColumn
} from '../../shared/components/data-table/data-table';

import { Warehouse } from './warehouse.model';
import { WarehousesApi } from './services/warehouses-api';
import { AsyncPipe, CommonModule } from '@angular/common';
import { WarehouseCreate } from './warehouse-create/warehouse-create';

@Component({
  selector: 'app-warehouses-page',
  imports: [AsyncPipe, DataTable, CommonModule, WarehouseCreate],
  templateUrl: './warehouses.html',
})
export class WarehousesPage implements OnInit {
  private readonly warehousesApi = inject(WarehousesApi);

  isCreateModalOpen = false;

  readonly warehouses$ = this.warehousesApi.warehouses$;

  readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Entrepôt' },
    { key: 'address', label: 'Adresse' },
    { key: 'productCount', label: 'Références' },
    { key: 'totalUnits', label: 'Unités en stock' },
  ];

  ngOnInit(): void {
    this.warehousesApi.getAll().subscribe();
  }

  addWarehouse(): void {
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }
}
