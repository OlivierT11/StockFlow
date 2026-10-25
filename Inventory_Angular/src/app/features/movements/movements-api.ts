import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-base-url';
import { MovementQuery, StockMovement, StockMovementCreate, StockMovementList } from '../../core/api/api-models';
import { todo } from '../../core/todo';

@Injectable({ providedIn: 'root' })
export class MovementsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/v1/stock/movements`;

  // TODO(B4) : GET /api/v1/stock/movements avec la requête en paramètres d'URL (HttpParams, voir ProductsApi.paged) :
  // warehouseId, from (inclus), to (exclu), askedPage, pageSize. Les dates sont des chaînes ISO en UTC.
  list(query: MovementQuery): Observable<StockMovementList> {
    return todo('B4', `MovementsApi.list(${JSON.stringify(query)}) → ${this.url}`);
  }

  // TODO(B4) : POST /api/v1/stock/movements avec le dto en corps. L'API répond le mouvement créé, ou 422 quand
  // un Out / Adjustment rendrait le stock négatif (son `detail` explique pourquoi).
  create(dto: StockMovementCreate): Observable<StockMovement> {
    return todo('B4', `MovementsApi.create(${dto.type} ${dto.quantity})`);
  }
}
