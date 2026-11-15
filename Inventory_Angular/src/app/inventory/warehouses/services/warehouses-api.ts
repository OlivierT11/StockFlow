import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Warehouse } from '../warehouse.model';
import { API_BASE_URL } from '../../../shared/api-base-url';

export type CreateWarehouseRequest = {
  name: string;
  address: string;
};

@Injectable({ providedIn: 'root' })
export class WarehousesApi {
  private readonly http = inject(HttpClient);
  private readonly warehousesSubject = new BehaviorSubject<Warehouse[]>([]);
  private loaded = false;

  readonly warehouses$ = this.warehousesSubject.asObservable();

  getAll(): Observable<Warehouse[]> {
    if (!this.loaded) {
      this.http.get<Warehouse[]>(`${API_BASE_URL}/warehouses`)
        .pipe(
          tap((warehouses) => {
            this.warehousesSubject.next(warehouses);
            this.loaded = true;
          })
        )
        .subscribe();
    }
    return this.warehouses$;
  }

  createWarehouse(warehouse: CreateWarehouseRequest): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${API_BASE_URL}/warehouses`, warehouse)
      .pipe(
        tap((createdWarehouse) => {
          const currentWarehouses = this.warehousesSubject.value;
          this.warehousesSubject.next([...currentWarehouses, createdWarehouse]);
        })
      );
  }
}
