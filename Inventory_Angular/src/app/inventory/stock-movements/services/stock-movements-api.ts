import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { StockMovement, StockMovementType } from '../stock-movement.model';
import { API_BASE_URL } from '../../../shared/api-base-url';

export type CreateStockMovementRequest = {
  productId: number;
  warehouseId: number;
  type: StockMovementType;
  quantity: number;
  reference?: string;
};

export type StockMovementsResponse = {
  movements: StockMovement[];
  totalItems: number;
  totalPages: number;
};

@Injectable({ providedIn: 'root' })
export class StockMovementsApi {
  private readonly http = inject(HttpClient);
  private readonly movementsSubject = new BehaviorSubject<StockMovement[]>([]);
  private loaded = false;

  readonly movements$ = this.movementsSubject.asObservable();

  getAll(): Observable<StockMovement[]> {
    if (!this.loaded) {
      this.http.get<StockMovementsResponse>(`${API_BASE_URL}/stock/movements`)
        .pipe(
          tap((response) => {
            this.movementsSubject.next(response.movements ?? []);
            this.loaded = true;
          })
        )
        .subscribe({ error: (err) => console.error('Erreur mouvements :', err) });
    }
    return this.movements$;
  }

  createStockMovement(movement: CreateStockMovementRequest): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${API_BASE_URL}/stock/movements`, movement)
      .pipe(
        tap((createdMovement) => {
          const currentMovements = this.movementsSubject.value;
          this.movementsSubject.next([...currentMovements, createdMovement]);
        })
      );
  }
}
