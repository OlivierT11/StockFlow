import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Product, PaginatedResponse, PaginationState } from '../product-list/product-list.model';
import { API_BASE_URL } from '../../../shared/api-base-url';

export type CreateProductRequest = {
  name: string;
  categoryId: number;
  price: number;
  stock: number;
  lowStockThreshold: number;
};

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly productsSubject = new BehaviorSubject<Product[]>([]);
  private readonly paginationSubject = new BehaviorSubject<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalPages: 0,
    products: []
  });
  private loaded = false;

  readonly products$ = this.productsSubject.asObservable();
  readonly pagination$ = this.paginationSubject.asObservable();

  getAll(): Observable<Product[]> {
    if (!this.loaded) {
      this.http.get<Product[]>(`${API_BASE_URL}/products`)
        .pipe(
          tap((products) => {
            this.productsSubject.next(products);
            this.loaded = true;
          })
        )
        .subscribe({
          error: (err) => console.error('Error loading products:', err)
        });
    }
    return this.products$;
  }

  getWithPager(pageNumber: number = 1, pageSize: number = 10): Observable<PaginatedResponse<Product>> {
    return this.http.get<PaginatedResponse<Product>>(
      `${API_BASE_URL}/products/paged`,
      {
        params: {
          askedPage: pageNumber.toString(),
          pageSize: pageSize.toString()
        }
      }
    ).pipe(
      tap((response) => {
        this.paginationSubject.next({
          currentPage: response.currentPage,
          pageSize: response.pageSize,
          totalPages: response.totalPages,
          products: response.products
        });
        this.productsSubject.next(response.products);
      })
    );
  }

  createProduct(product: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(`${API_BASE_URL}/products`, product)
      .pipe(
        tap((createdProduct) => {
          const currentProducts = this.productsSubject.value;
          this.productsSubject.next([...currentProducts, createdProduct]);
        })
      );
  }
}
