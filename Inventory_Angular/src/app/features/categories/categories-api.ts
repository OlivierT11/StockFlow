import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-base-url';
import { Category } from '../../core/api/api-models';

/**
 * Exemple commenté d'un service de données (étape B4) : une méthode par endpoint, chacune renvoie l'Observable
 * de HttpClient. Pas d'état ni d'abonnement ici : c'est l'appelant qui décide quand s'abonner.
 * WarehousesApi (exercice) suit le même modèle.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/v1/categories`;

  list(): Observable<Category[]> {
    return this.http.get<Category[]>(this.url);
  }

  create(name: string): Observable<Category> {
    return this.http.post<Category>(this.url, { name });
  }

  // LEARN(B4) : PUT et DELETE répondent 204 No Content : l'Observable émet null, typé void.
  update(id: number, name: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}`, { name });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
