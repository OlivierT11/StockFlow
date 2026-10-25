import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-base-url';
import { Warehouse, WarehouseRequest } from '../../core/api/api-models';
import { todo } from '../../core/todo';

/**
 * TODO(B4) : implémente les quatre méthodes sur /api/v1/warehouses, exactement comme CategoriesApi le fait pour
 * /api/v1/categories. Le corps de create / update est { name, address } (WarehouseRequest).
 * Utilisé par WarehousesPage, MovementForm et MovementsPage.
 */
@Injectable({ providedIn: 'root' })
export class WarehousesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/v1/warehouses`;

  list(): Observable<Warehouse[]> {
    return todo('B4', `WarehousesApi.list (${this.url})`);
  }

  create(dto: WarehouseRequest): Observable<Warehouse> {
    return todo('B4', `WarehousesApi.create(${dto.name})`);
  }

  update(id: number, dto: WarehouseRequest): Observable<void> {
    return todo('B4', `WarehousesApi.update(${id}, ${dto.name})`);
  }

  remove(id: number): Observable<void> {
    return todo('B4', `WarehousesApi.remove(${id})`);
  }
}
