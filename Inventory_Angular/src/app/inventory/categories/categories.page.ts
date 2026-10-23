import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DataTable,
  type DataTableColumn
} from '../../shared/components/data-table/data-table';

import { CategoriesApi } from './categories-api';
import { Category } from './category.model';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-categories-page',
  imports: [AsyncPipe, DataTable],
  templateUrl: './categories.page.html',
})
export class CategoriesPage {
  private readonly categoriesApi = inject(CategoriesApi);
  readonly categories$: Observable<Category[]> = this.categoriesApi.getAll();
  // Defines the category table columns and their displayed labels.
  readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Catégorie' },
    { key: 'description', label: 'Description' },
    { key: 'productCount', label: 'Nombre de produits' },
  ];
}
