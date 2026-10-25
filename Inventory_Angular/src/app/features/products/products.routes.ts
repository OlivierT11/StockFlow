import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/auth-guards';

/**
 * Child routes of /produits, loaded by `loadChildren` in app.routes.ts.
 *
 * LEARN(B5) : les routes sont testées dans l'ordre, la première qui correspond gagne : 'nouveau' doit venir avant
 * ':id', sinon /produits/nouveau ouvrirait la page de détail avec id = "nouveau".
 * LEARN(C4) : avec loadComponent, chaque page est un chunk lazy séparé, téléchargé à la première visite.
 * `npm run build` les liste sous "Lazy chunk files".
 */
export default [
  {
    path: '',
    title: 'Produits',
    loadComponent: () => import('./product-list/products-page').then((m) => m.ProductsPage),
  },
  {
    path: 'nouveau',
    title: 'Nouveau produit',
    canActivate: [adminGuard],
    loadComponent: () => import('./product-form/product-form-page').then((m) => m.ProductFormPage),
  },
  {
    path: ':id',
    title: 'Détail du produit',
    loadComponent: () => import('./product-detail/product-detail-page').then((m) => m.ProductDetailPage),
  },
  {
    path: ':id/modifier',
    title: 'Modifier le produit',
    canActivate: [adminGuard],
    loadComponent: () => import('./product-form/product-form-page').then((m) => m.ProductFormPage),
  },
] satisfies Routes;
