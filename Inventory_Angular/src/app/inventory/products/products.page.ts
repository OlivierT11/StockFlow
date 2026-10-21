import { Component, inject, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, of } from 'rxjs';
import { DataTableColumn } from '../../shared/components/data-table/data-table';
import { Product } from './product.model';
import { ProductsApi } from './products-api';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-products-page',
  standalone: false,
  templateUrl: './products.page.html',
})
export class ProductsPage implements OnInit {
  private readonly productsApi = inject(ProductsApi);
  private readonly authService = inject(AuthService);

  readonly products$: Observable<Product[]> = this.productsApi.getAll().pipe(
    catchError(error => {
      console.error('Erreur lors du chargement des produits:', error);
      return of([]);
    })
  );
  readonly columns: DataTableColumn[] = [
    { key: 'sku', label: 'Référence' },
    { key: 'name', label: 'Produit' },
    { key: 'categoryName', label: 'Catégorie' },
    { key: 'quantity', label: 'Quantité' },
    { key: 'minimumStock', label: 'Seuil minimum' },
    { key: 'unitPrice', label: 'Prix unitaire' },
    { key: 'warehouseName', label: 'Entrepôt' },
  ];

  ngOnInit(): void {
    const token = this.authService.getToken();
    console.log('📋 ProductsPage ngOnInit - Token disponible:', token ? 'OUI (longueur: ' + token.length + ')' : 'NON');
    if (token) {
      console.log('📋 Token:', token.substring(0, 80) + '...');
    }
  }
}
