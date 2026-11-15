import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';

import {
  DataTable,
  type DataTableColumn
} from '../../../shared/components/data-table/data-table';

import { Product } from './product-list.model';
import { ProductsApi } from '../services/products-api';
import { ProductCreate } from '../product-create/product-create';

@Component({
  selector: 'app-products-page',
  imports: [AsyncPipe, DataTable, CommonModule, ProductCreate],
  templateUrl: './product-list.html',
  styleUrls: ['./product-list.css'],
})
export class ProductsPage implements OnInit {

  private readonly productsApi = inject(ProductsApi);

  isCreateModalOpen = false;
  currentPage = 1;
  pageSize = 10;
  totalPages = 0;

  readonly products$ = this.productsApi.products$;
  readonly pagination$ = this.productsApi.pagination$;

  readonly columns: DataTableColumn[] = [
    { key: 'id', label: 'Référence' },
    { key: 'name', label: 'Produit' },
    { key: 'categoryName', label: 'Catégorie' },
    { key: 'stock', label: 'Quantité' },
    { key: 'lowStockThreshold', label: 'Seuil minimum' },
    { key: 'price', label: 'Prix unitaire' },
    { key: 'warehouseName', label: 'Entrepôt' },
  ];

  ngOnInit(): void {
    this.loadPage(1);
  }

  loadPage(pageNumber: number): void {
    this.currentPage = pageNumber;
    this.productsApi.getWithPager(pageNumber, this.pageSize).subscribe({
      next: (response) => {
        this.totalPages = response.totalPages;
        this.currentPage = pageNumber;
      },
      error: (err) => console.error('Error loading products page:', err)
    });
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadPage(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadPage(this.currentPage + 1);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.loadPage(page);
    }
  }

  addProduct(): void {
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }
}
