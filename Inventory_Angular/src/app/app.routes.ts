import { Routes } from '@angular/router';
import { AdminLayout } from './layout/admin-layout';
import { AuthGuard } from './auth/auth.guard';
import { CategoriesPage } from './inventory/categories/categories.page';
import { DashboardPage } from './inventory/dashboard/dashboard.page';
import { LoginPage } from './auth/login/login.page';
import { ProductsPage } from './inventory/products/products.page';
import { StockMovementsPage } from './inventory/stock-movements/stock-movements.page';
import { WarehousesPage } from './inventory/warehouses/warehouses.page';
import { ProductCreate } from './inventory/products/product-create/product-create';

// Define the application routes, including public and protected routes
export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    title: 'Login | StockFlow',
  },
  {
    path: '',
    component: AdminLayout,
    canActivate: [AuthGuard],
    // Define child routes for the admin layout, which are protected by the AuthGuard
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: DashboardPage,
        title: 'Tableau de bord | StockFlow',
      },
      {
        path: 'products/new',
        component: ProductCreate,
        title: 'Créer un produit',
      },
      {
        path: 'products',
        component: ProductsPage,
        title: 'Produits | StockFlow',
      },
      {
        path: 'stock-movements',
        component: StockMovementsPage,
        title: 'Mouvements de stock | StockFlow',
      },
      {
        path: 'categories',
        component: CategoriesPage,
        title: 'Catégories | StockFlow',
      },
      {
        path: 'warehouses',
        component: WarehousesPage,
        title: 'Entrepôts | StockFlow',
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
