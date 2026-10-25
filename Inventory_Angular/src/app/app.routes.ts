import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth-guards';
import { ForbiddenPage } from './features/errors/forbidden-page';
import { NotFoundPage } from './features/errors/not-found-page';
import { Shell } from './layout/shell';

/**
 * LEARN(B5) : la table des routes. Chaque entrée associe un chemin d'URL à un composant.
 *   - `title` définit le titre de l'onglet (TitleStrategy d'Angular ; étends-la pour ajouter " — Inventory").
 *   - `canActivate` exécute des guards avant d'entrer dans la route.
 *   - `children` s'affichent dans le <router-outlet /> du parent (ici : dans le layout Shell).
 *   - `loadComponent` / `loadChildren` chargent le code à la première visite (lazy loading, étape C4).
 *     Le Shell et les pages d'erreur sont importés directement : ils font partie du bundle initial.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Connexion',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'inscription',
    title: 'Inscription',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage),
  },

  // Paths of the first version of the React app.
  { path: 'Product_List', redirectTo: 'produits' },
  { path: 'Product_Add', redirectTo: 'produits/nouveau' },

  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tableau de bord',
        loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      // A whole feature: its own route file, loaded with its first page.
      { path: 'produits', loadChildren: () => import('./features/products/products.routes') },
      {
        path: 'mouvements',
        title: 'Mouvements',
        loadComponent: () => import('./features/movements/movements-page').then((m) => m.MovementsPage),
      },
      {
        path: 'categories',
        title: 'Catégories',
        loadComponent: () => import('./features/categories/categories-page').then((m) => m.CategoriesPage),
      },
      {
        path: 'entrepots',
        title: 'Entrepôts',
        loadComponent: () => import('./features/warehouses/warehouses-page').then((m) => m.WarehousesPage),
      },
      { path: 'interdit', title: 'Accès refusé', component: ForbiddenPage },
      // Wildcard: any other URL. Must stay last.
      { path: '**', title: 'Page introuvable', component: NotFoundPage },
    ],
  },
];
