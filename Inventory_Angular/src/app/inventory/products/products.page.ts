import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, of } from 'rxjs';
import { Router } from '@angular/router';

import {
  DataTable,
  type DataTableColumn
} from '../../shared/components/data-table/data-table';

import { Product } from './product.model';
import { ProductsApi } from './services/products-api';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-products-page',
  imports: [AsyncPipe, DataTable],
  templateUrl: './products.page.html',
})
export class ProductsPage {

  private readonly productsApi = inject(ProductsApi);
  private readonly router = inject(Router);

  readonly products$: Observable<Product[]> = this.productsApi.getAll().pipe(
    catchError(error => {
      console.error('Erreur lors du chargement des produits:', error);
      return of([]);
    })
  );

  readonly columns: DataTableColumn[] = [
    { key: 'id', label: 'Référence' },
    { key: 'name', label: 'Produit' },
    { key: 'categoryName', label: 'Catégorie' },
    { key: 'stock', label: 'Quantité' },
    { key: 'lowStockThreshold', label: 'Seuil minimum' },
    { key: 'price', label: 'Prix unitaire' },
    { key: 'warehouseName', label: 'Entrepôt' },
  ];

  addProduct(): void {
    this.router.navigate(['/products/new']);
  }
}
