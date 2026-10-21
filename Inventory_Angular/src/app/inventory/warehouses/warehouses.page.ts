import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataTableColumn } from '../../shared/components/data-table/data-table';
import { Warehouse } from './warehouse.model';
import { WarehousesApi } from './warehouses-api';

@Component({
  selector: 'app-warehouses-page',
  standalone: false,
  templateUrl: './warehouses.page.html',
})
export class WarehousesPage {
  private readonly warehousesApi = inject(WarehousesApi);
  readonly warehouses$: Observable<Warehouse[]> = this.warehousesApi.getAll();
  readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Entrepôt' },
    { key: 'address', label: 'Adresse' },
    { key: 'productCount', label: 'Références' },
    { key: 'totalUnits', label: 'Unités en stock' },
  ];
}
