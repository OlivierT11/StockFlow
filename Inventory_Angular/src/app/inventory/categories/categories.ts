import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DataTable,
  type DataTableColumn
} from '../../shared/components/data-table/data-table';

import { CategoriesApi } from './services/categories-api';
import { Category } from './category.model';
import { AsyncPipe, CommonModule } from '@angular/common';
import { CategoryCreate } from './category-create/category-create';

@Component({
  selector: 'app-categories-page',
  imports: [AsyncPipe, DataTable, CommonModule, CategoryCreate],
  templateUrl: './categories.html',
})
export class CategoriesPage {
  private readonly categoriesApi = inject(CategoriesApi);

  isCreateModalOpen = false;

  readonly categories$: Observable<Category[]> = this.categoriesApi.getAll();
  readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Catégorie' },
    { key: 'description', label: 'Description' },
    { key: 'productCount', label: 'Nombre de produits' },
  ];

  addCategory(): void {
    this.isCreateModalOpen = true;
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
  }
}
