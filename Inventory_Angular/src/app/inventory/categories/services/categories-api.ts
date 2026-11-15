import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Category } from '../category.model';
import { API_BASE_URL } from '../../../shared/api-base-url';

export type CreateCategoryRequest = {
  name: string;
  description: string;
};

export type CategoriesResponse = {
  categories: Category[];
};

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly http = inject(HttpClient);

  // BehaviorSubject is a type of Observable that holds a value and emits it to new subscribers.
  // It prevents a new HTTP request from being sent each time a new subscriber subscribes to the categories$ Observable.
  private readonly categoriesSubject = new BehaviorSubject<Category[]>([]);
  private loaded = false;

  // categories$ is an Observable that emits the current value of categoriesSubject.
  readonly categories$ = this.categoriesSubject.asObservable();

  getAll(): Observable<Category[]> {
    if (!this.loaded) { // If the categories have not been loaded yet, fetch them from the API.
      this.http.get<Category[]>(`${API_BASE_URL}/categories`)
        .pipe(
          tap((categories) => { // When the categories are fetched, update the BehaviorSubject and mark as loaded.
            this.categoriesSubject.next(categories ?? []); // Update the BehaviorSubject with the fetched categories.
            this.loaded = true;
          })
        )
        .subscribe(
          { error: (err) => console.error('Erreur catégories :', err) }
        );
    }
    return this.categories$;
  }

  createCategory(category: CreateCategoryRequest): Observable<Category> {
    return this.http.post<Category>(`${API_BASE_URL}/categories`, category)
      .pipe(
        tap((createdCategory) => { // When a new category is created, update the BehaviorSubject with the new category.
          const currentCategories = this.categoriesSubject.value;
          this.categoriesSubject.next([...currentCategories, createdCategory]);
        })
      );
  }
}
