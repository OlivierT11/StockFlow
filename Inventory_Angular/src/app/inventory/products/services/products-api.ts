import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../product.model';
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

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(`${API_BASE_URL}/products`);
  }

  createProduct(product: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(`${API_BASE_URL}/products`, product);
  }
}
