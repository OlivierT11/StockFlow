import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product, ProductList, ProductQuery, ProductSort } from '../../../core/api/api-models';
import { AuthService } from '../../../core/auth/auth-service';
import { ToastService } from '../../../core/notifications/toast-service';
import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorBanner } from '../../../shared/ui/error-banner';
import { Icon } from '../../../shared/ui/icon';
import { Modal } from '../../../shared/ui/modal';
import { PageHead } from '../../../shared/ui/page-head';
import { Pagination } from '../../../shared/ui/pagination';
import { CategoriesApi } from '../../categories/categories-api';
import { ProductsApi } from '../products-api';
import { ProductTable } from './product-table';

const SIZES = [10, 25, 50, 100];
const SORTS: ProductSort[] = ['name', 'price', 'stock'];

type QueryPatch = Record<string, string | number | boolean | null | undefined>;

/**
 * Liste des produits avec recherche, filtres, tri et pagination. Un composant *conteneur* (« smart », étape B3) :
 * il possède les données et l'URL, et passe les lignes au composant de présentation ProductTable.
 *
 * Flux de données, dans un seul sens :
 *   query params de l'URL → inputs → query() → ressource products → template
 *   action de l'utilisateur → apply() → nouvelle URL → (même boucle)
 * L'URL est la seule source de vérité des filtres : les liens se partagent et le bouton Précédent fonctionne.
 */
@Component({
  selector: 'app-products-page',
  imports: [FormsModule, RouterLink, PageHead, ErrorBanner, EmptyState, Pagination, ProductTable, Modal, Icon],
  templateUrl: './products-page.html',
})
export class ProductsPage {
  private readonly api = inject(ProductsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  // LEARN(B5) : withComponentInputBinding() relie chaque query param à l'input de même nom :
  // /produits?search=vis&page=2 → search() === 'vis', page() === '2'. Toujours des chaînes, ou undefined.
  readonly search = input<string>();
  readonly cat = input<string>();
  readonly min = input<string>();
  readonly max = input<string>();
  readonly low = input<string>();
  readonly sort = input<string>();
  readonly dir = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly sizes = SIZES;

  /** The URL parameters, parsed and validated into the API query. */
  protected readonly query = computed<ProductQuery>(() => {
    const size = Number(this.size());
    const sort = this.sort() as ProductSort;
    return {
      askedPage: Math.max(1, Number(this.page()) || 1),
      pageSize: SIZES.includes(size) ? size : 10,
      name: this.search() || undefined,
      categoryId: this.cat() ? Number(this.cat()) : undefined,
      minPrice: this.min() ? Number(this.min()) : undefined,
      maxPrice: this.max() ? Number(this.max()) : undefined,
      lowStockOnly: this.low() === '1' || undefined,
      sortBy: SORTS.includes(sort) ? sort : 'name',
      sortDirection: this.dir() === 'desc' ? 'desc' : 'asc',
    };
  });

  protected readonly hasFilters = computed(() => !!(this.search() || this.cat() || this.min() || this.max() || this.low()));

  // LEARN(B4) : `params` rend la ressource réactive : quand query() change, la requête en cours est annulée
  // et une nouvelle démarre. Pas de subscribe, pas de « recharger au changement » à la main.
  protected readonly products = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.paged(params),
  });

  // LEARN(B2) : pendant le chargement de la page suivante, products.value() vaut undefined. linkedSignal() garde la
  // dernière liste à l'écran (grisée) au lieu de faire clignoter l'état chargement : son calcul reçoit la valeur
  // précédente.
  protected readonly list = linkedSignal<ProductList | undefined, ProductList | undefined>({
    source: () => (this.products.hasValue() ? this.products.value() : undefined),
    computation: (current, previous) => current ?? previous?.value,
  });

  protected readonly categories = rxResource({ stream: () => this.categoriesApi.list() });

  // LEARN(B2) : linkedSignal() avec une seule fonction : un signal modifiable (la zone de recherche écrit dedans)
  // qui se réinitialise dès que le `search` de l'URL change (bouton Précédent, "Effacer les filtres").
  protected readonly searchText = linkedSignal(() => this.search() ?? '');

  protected readonly toDelete = signal<Product | null>(null);

  constructor() {
    // TODO(C1) : rechercher pendant la frappe, sans une requête par touche :
    //   toObservable(this.searchText) → debounceTime(300) → map(text => text.trim()) → distinctUntilChanged()
    //   → subscribe(text => this.apply({ search: text }))
    // et place takeUntilDestroyed() juste avant subscribe() : cet abonnement vit aussi longtemps que la page et ne
    // se termine jamais seul (contrairement à un appel HttpClient), il doit donc être fermé avec la page.
    // En attendant, la recherche s'applique avec la touche Entrée (submitSearch).
  }

  protected submitSearch(): void {
    this.apply({ search: this.searchText().trim() });
  }

  protected sortBy(key: ProductSort): void {
    const q = this.query();
    this.apply({ sort: key, dir: q.sortBy === key && q.sortDirection === 'asc' ? 'desc' : 'asc' });
  }

  protected clearFilters(): void {
    this.apply({ search: null, cat: null, min: null, max: null, low: null });
  }

  /** Changes query parameters. Every change except a page change goes back to page 1. */
  protected apply(patch: QueryPatch): void {
    const queryParams: QueryPatch = { page: null };
    for (const [key, value] of Object.entries(patch)) {
      queryParams[key] = value === '' || value === false || value === undefined ? null : value === true ? 1 : value;
    }
    // LEARN(B5) : navigate([], { relativeTo }) reste sur cette page ; 'merge' garde les autres paramètres, une valeur
    // null en retire un ; replaceUrl n'ajoute pas d'entrée d'historique à chaque changement de filtre.
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // TODO(B4) : supprime le produit : api.remove(product.id), puis en cas de succès un toast ("Produit supprimé")
  // et this.products.reload() ; en cas d'erreur un toast avec errorMessage(err) (409 : le produit a des mouvements).
  // CategoriesPage.confirmDelete() fait exactement cela pour une catégorie.
  protected confirmDelete(product: Product): void {
    this.toDelete.set(null);
    this.toast.show('info', 'À implémenter — TODO(B4)', `Suppression de ${product.name}`);
  }
}
