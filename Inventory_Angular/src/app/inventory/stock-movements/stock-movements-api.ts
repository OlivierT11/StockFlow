import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMovement } from './stock-movement.model';
import { API_BASE_URL } from '../../shared/api-base-url';

@Injectable({ providedIn: 'root' })
export class StockMovementsApi {
  private readonly http = inject(HttpClient);

  getAll(): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${API_BASE_URL}/stock-movements`);
  }
}
