import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-base-url';
import {
  Product,
  ProductCreate,
  ProductList,
  ProductQuery,
  ProductUpdate,
  StockMovementList,
} from '../../core/api/api-models';
import { todo } from '../../core/todo';

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/v1/products`;

  /** Every product (used for counts and pickers; prefer paged() for lists). */
  all(): Observable<Product[]> {
    return this.http.get<Product[]>(this.url);
  }

  /** GET /products/paged: search, filters, sort and pagination. */
  paged(query: ProductQuery): Observable<ProductList> {
    // LEARN(B4) : HttpParams construit la query string (?askedPage=2&name=vis) et encode les valeurs.
    // Il est immuable : set() renvoie une nouvelle instance. Les filtres vides sont omis.
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, value);
    }
    return this.http.get<ProductList>(`${this.url}/paged`, { params });
  }

  // TODO(B4) : GET /api/v1/products/{id}. Regarde CategoriesApi pour le modèle.
  get(id: number): Observable<Product> {
    return todo('B4', `ProductsApi.get(${id})`);
  }

  // TODO(B4) : POST /api/v1/products avec le dto en corps ; l'API répond le Product créé.
  create(dto: ProductCreate): Observable<Product> {
    return todo('B4', `ProductsApi.create(${dto.name})`);
  }

  // TODO(B4) : PUT /api/v1/products/{dto.id} avec le dto en corps (204 No Content).
  update(dto: ProductUpdate): Observable<void> {
    return todo('B4', `ProductsApi.update(${dto.id})`);
  }

  // TODO(B4) : DELETE /api/v1/products/{id}. Un produit qui a des mouvements ne peut pas être supprimé : l'API répond 409.
  remove(id: number): Observable<void> {
    return todo('B4', `ProductsApi.remove(${id})`);
  }

  // TODO(B4) : GET /api/v1/products/{id}/movements?askedPage=…&pageSize=… : l'historique d'un produit.
  movements(id: number, page: number, pageSize: number): Observable<StockMovementList> {
    return todo('B4', `ProductsApi.movements(${id}, ${page}, ${pageSize})`);
  }
}
