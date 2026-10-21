import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Warehouse } from './warehouse.model';
import { API_BASE_URL } from '../../shared/api-base-url';

@Injectable({ providedIn: 'root' })
export class WarehousesApi {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${API_BASE_URL}/warehouses`);
  }
}
