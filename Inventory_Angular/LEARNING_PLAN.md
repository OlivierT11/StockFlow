# Plan d'apprentissage : Inventory en Angular

Objectif : refaire [`Inventory_React`](../Inventory_React) en Angular 22 tout en apprenant le framework. Les étapes
suivent le « Plan d'apprentissage Angular (2026) », de A1 à C4. L'architecture est déjà en place. Chaque étape a
des **exemples commentés** à lire et des **exercices** à terminer dans la vraie application.

## Comment travailler

1. Démarre l'API : `dotnet run --project Inventory_Api/Inventory` (http://localhost:5293, code dans
   [`Inventory_Api/Inventory`](../Inventory_Api/Inventory)).
   Elle ne crée aucun utilisateur. Crée un compte avec Swagger UI (http://localhost:5293/swagger,
   `POST /api/v1/auth/register`) ou avec l'application React, car la page d'inscription Angular est
   elle-même un exercice (C2). Pour accéder aux écrans d'administration, passe le rôle de cet utilisateur à
   `Admin` dans la base de données.
2. Démarre l'application : `npm start` (http://localhost:4200), et les tests : `npm test`.
3. Suis les étapes dans l'ordre. Deux marqueurs relient le code au plan :
   - `LEARN(B2)` : une explication à côté de code qui fonctionne. Lis-les en premier.
   - `TODO(B2)` : un exercice, parfois marqué avec deux étapes (`TODO(B4, B5)`).
     `grep -rnE "TODO\([^)]*B2" src` liste tous les exercices d'une étape.
4. Ce qui n'est pas terminé échoue de façon visible :
   - L'interface affiche *« À implémenter : ProductsApi.get(1) — TODO(B4) »* (voir [`core/todo.ts`](src/app/core/todo.ts)).
   - Les tests des exercices sont écrits mais désactivés (`describe.skip`). Retire `.skip` quand tu as fini l'exercice.
5. Si tu bloques, la fonctionnalité [**catégories**](src/app/features/categories) est une référence complète.
   C'est le modèle pour les entrepôts, les produits et les mouvements.

## Architecture

- [`src/app/`](src/app)
  - [`app.config.ts`](src/app/app.config.ts) : providers de l'application : router, HttpClient + intercepteur,
    locale, vérification de session au démarrage.
  - [`app.routes.ts`](src/app/app.routes.ts) : table des routes : pages publiques, puis le Shell avec les
    fonctionnalités en lazy loading.
  - [`core/`](src/app/core) : singletons de toute l'application, utilisés partout.
    - [`api/`](src/app/core/api) : types de l'API ([`api-models.ts`](src/app/core/api/api-models.ts)), utilitaires
      d'erreur ([`api-error.ts`](src/app/core/api/api-error.ts)), jeton [`API_BASE_URL`](src/app/core/api/api-base-url.ts).
    - [`auth/`](src/app/core/auth) : [`AuthService`](src/app/core/auth/auth-service.ts) (état de session en signals),
      [stockage des jetons](src/app/core/auth/token-storage.ts), [intercepteur](src/app/core/auth/auth-interceptor.ts),
      [guards](src/app/core/auth/auth-guards.ts).
    - [`notifications/`](src/app/core/notifications) : [`ToastService`](src/app/core/notifications/toast-service.ts)
      + [`ToastContainer`](src/app/core/notifications/toast-container.ts).
    - [`todo.ts`](src/app/core/todo.ts) : utilitaire des stubs d'exercices.
  - [`shared/`](src/app/shared) : briques réutilisables, sans appel métier.
    - [`ui/`](src/app/shared/ui) : Icon, Modal, Pagination, PageHead, EmptyState, ErrorBanner.
    - [`inventory/`](src/app/shared/inventory) : aides d'affichage métier : StockBadge, MovementTypeBadge,
      pipes apiDate / signedQty, stockState.
  - [`layout/`](src/app/layout) : [Shell](src/app/layout/shell.ts) : barre latérale, barre du haut, bandeau de
    session, `<router-outlet>`.
  - [`features/`](src/app/features) : un dossier par fonctionnalité : son service d'API, ses pages, ses routes.
    [`auth/`](src/app/features/auth) · [`dashboard/`](src/app/features/dashboard) ·
    [`products/`](src/app/features/products) · [`movements/`](src/app/features/movements) ·
    [`categories/`](src/app/features/categories) · [`warehouses/`](src/app/features/warehouses) ·
    [`errors/`](src/app/features/errors)

Règles :
- `shared` n'importe jamais depuis `features`, et `core` n'importe ni l'un ni l'autre.
- Un seul flux de données partout :
  - **service d'API** (renvoie des Observables) → **`rxResource`** dans la page (signals) → **template**.
  - Les écritures font : `subscribe()` → toast → `resource.reload()`.
- Les pages sont des *conteneurs* (données, URL, services). Les composants de `shared/` et les tableaux sont
  des composants de *présentation* (`input()` / `output()` uniquement).
- L'URL porte les filtres des listes (`/produits?search=vis&page=2`). Les pages les lisent comme des inputs et
  les modifient avec `router.navigate`.

## Étapes

### Tier A : les fondations

**A1. CLI et anatomie du projet**
- À lire :
  - [`main.ts`](src/main.ts), [`app.config.ts`](src/app/app.config.ts), [`app.ts`](src/app/app.ts).
  - [`angular.json`](angular.json) : les cibles build, serve et test, `fileReplacements`, et les budgets.
  - [`src/environments/`](src/environments).
- À faire :
  - `npm run build`, puis lis le tableau des chunks : chunks initiaux, chunks lazy et leurs noms.
  - `npx ng generate component shared/ui/loading-state`, puis remplace par ce composant les paragraphes
    `<p … aria-busy="true">Chargement…</p>`.

**A2. Composants et templates**
- À lire :
  - [`shared/ui/icon.ts`](src/app/shared/ui/icon.ts) : le plus petit composant utile.
  - [`stock-badge.ts`](src/app/shared/inventory/stock-badge.ts) : `@switch`.
  - [`toast-container.ts`](src/app/core/notifications/toast-container.ts) : `@for` avec `track`.
  - [`page-head.ts`](src/app/shared/ui/page-head.ts), [`empty-state.ts`](src/app/shared/ui/empty-state.ts),
    [`modal.ts`](src/app/shared/ui/modal.ts) : projection de contenu et `viewChild`.
  - [`layout/shell.html`](src/app/layout/shell.html).
- À faire (`TODO(A2)`) :
  - [`MovementTypeBadge`](src/app/shared/inventory/movement-type-badge.ts).
  - Les actions d'administration dans [`product-table.html`](src/app/features/products/product-list/product-table.html).
  - La liste des produits sous seuil et le tableau des derniers mouvements du
    [tableau de bord](src/app/features/dashboard/dashboard-page.html).
  - Les barres de [`StockChart`](src/app/features/dashboard/stock-chart.ts).

**A3. Directives, pipes, styles**
- À lire :
  - [`api-date-pipe.ts`](src/app/shared/inventory/api-date-pipe.ts) : un pipe personnalisé.
  - [`icon.ts`](src/app/shared/ui/icon.ts) : `:host` et `[attr.x]`.
  - [`modal.ts`](src/app/shared/ui/modal.ts) : styles isolés.
  - L'en-tête de [`styles.scss`](src/styles.scss) : styles globaux.
  - [`app.config.ts`](src/app/app.config.ts) : `LOCALE_ID` pour les pipes intégrés.
- À faire (`TODO(A3)`) :
  - Le pipe [`signedQty`](src/app/shared/inventory/signed-qty-pipe.ts), puis réactive
    [son test](src/app/shared/inventory/signed-qty-pipe.spec.ts).
  - Une deuxième version de [`MovementTypeBadge`](src/app/shared/inventory/movement-type-badge.ts) avec
    `[class]` / `ngClass`.
  - Déplace les styles des toasts de [`styles.scss`](src/styles.scss) dans
    [le composant](src/app/core/notifications/toast-container.ts).
  - Bonus : une directive d'attribut `appAutofocus` (`ElementRef` + `afterNextRender`) sur le champ e-mail
    de la [connexion](src/app/features/auth/login-page.html).

### Tier B : le cœur d'une vraie application

**B1. TypeScript**
- À lire :
  - [`core/api/api-models.ts`](src/app/core/api/api-models.ts) : unions, intersections, `Omit`, `Pick`, `null`
    contre propriété facultative.
  - [`core/todo.ts`](src/app/core/todo.ts) : une fonction générique.
- À faire (`TODO(B1)`) : [`stockState()`](src/app/shared/inventory/stock-state.ts), puis réactive
  [`stock-state.spec.ts`](src/app/shared/inventory/stock-state.spec.ts).

**B2. Signals**
- À lire :
  - [`AuthService`](src/app/core/auth/auth-service.ts) : `signal`, `asReadonly`, `computed`.
  - [`ToastService`](src/app/core/notifications/toast-service.ts) : `update` immuable.
  - [`Modal`](src/app/shared/ui/modal.ts) : `effect`, utilisé seulement pour se synchroniser avec le DOM.
  - [`ProductsPage`](src/app/features/products/product-list/products-page.ts) : deux usages de `linkedSignal`.
  - [`CategoriesPage.rows`](src/app/features/categories/categories-page.ts) : un `computed` sur deux ressources.
- À faire (`TODO(B2)`) :
  - [`AuthService.isAdmin`](src/app/core/auth/auth-service.ts) : cela débloque tous les boutons
    d'administration et le guard admin.
  - [`StockChart.days`](src/app/features/dashboard/stock-chart.ts).
  - [`MovementForm.stockAfter`](src/app/features/movements/movement-form.ts).

**B3. Services et injection de dépendances**
- À lire :
  - `providedIn: 'root'` et `inject()` dans n'importe quel service, par exemple
    [`AuthService`](src/app/core/auth/auth-service.ts).
  - [`api-base-url.ts`](src/app/core/api/api-base-url.ts) : un `InjectionToken`.
  - `provideAppInitializer` dans [`app.config.ts`](src/app/app.config.ts).
  - Le conteneur [`ProductsPage`](src/app/features/products/product-list/products-page.ts) et le composant de
    présentation [`ProductTable`](src/app/features/products/product-list/product-table.ts).
  - [`ProductDetailPage`](src/app/features/products/product-detail/product-detail-page.html) et
    [`MovementForm`](src/app/features/movements/movement-form.ts) : les inputs descendent, les outputs remontent.
- À faire (`TODO(B3)`) : la suppression sur la [page des entrepôts](src/app/features/warehouses/warehouses-page.ts).

**B4. HttpClient**
- À lire :
  - [`categories-api.ts`](src/app/features/categories/categories-api.ts) : le service de référence.
  - [`ProductsApi.paged`](src/app/features/products/products-api.ts) : `HttpParams`.
  - [`AuthService.login`](src/app/core/auth/auth-service.ts).
  - [`auth-interceptor.ts`](src/app/core/auth/auth-interceptor.ts).
  - `rxResource` dans [`categories-page.ts`](src/app/features/categories/categories-page.ts), et pourquoi il ne
    faut pas lire `value()` en état d'erreur.
- À faire (`TODO(B4)`) :
  - Le reste de [`ProductsApi`](src/app/features/products/products-api.ts).
  - [`WarehousesApi`](src/app/features/warehouses/warehouses-api.ts).
  - [`MovementsApi`](src/app/features/movements/movements-api.ts).
  - [`AuthService.register` / `logout`](src/app/core/auth/auth-service.ts).
  - [`ProductsPage.confirmDelete`](src/app/features/products/product-list/products-page.ts).
- Vérification : plus aucun message « À implémenter … TODO(B4) » dans l'interface.

**B5. Routing**
- À lire :
  - [`app.routes.ts`](src/app/app.routes.ts) : imbrication, `title`, `redirectTo`, route joker, `loadChildren`.
  - [`products.routes.ts`](src/app/features/products/products.routes.ts) : ordre des routes, `loadComponent`.
  - [`authGuard`](src/app/core/auth/auth-guards.ts).
  - Paramètres de route et query params reliés à des inputs :
    - [`ProductDetailPage.id`](src/app/features/products/product-detail/product-detail-page.ts)
    - les filtres de [`ProductsPage`](src/app/features/products/product-list/products-page.ts)
    - [`LoginPage.returnUrl`](src/app/features/auth/login-page.ts)
  - [`ProductsPage.apply()`](src/app/features/products/product-list/products-page.ts) : écrire dans l'URL.
- À faire (`TODO(B5)`) :
  - [`guestGuard` et `adminGuard`](src/app/core/auth/auth-guards.ts).
  - L'historique paginé de la [page de détail produit](src/app/features/products/product-detail/product-detail-page.ts)
    (`?page=`).
  - Les query params de [`MovementsPage`](src/app/features/movements/movements-page.ts).

**B6. Cycle de vie et formulaires template-driven**
- À lire :
  - [`login-page.html`](src/app/features/auth/login-page.html) et [`login-page.ts`](src/app/features/auth/login-page.ts) :
    `ngModel` sur des signals, `#ref="ngModel"`, directives de validation, `NgForm`.
  - La barre de filtres de [`products-page.html`](src/app/features/products/product-list/products-page.html).
  - [`ProductFormPage.ngOnInit`](src/app/features/products/product-form/product-form-page.ts) : pourquoi pas
    le constructeur.
- À faire (`TODO(B6)`) :
  - Les filtres de prix et de stock bas dans
    [`products-page.html`](src/app/features/products/product-list/products-page.html).
  - La barre de filtres des [mouvements](src/app/features/movements/movements-page.ts).

Fin du tier B : l'application liste, recherche, filtre et pagine les produits, affiche un produit, gère les
catégories et les entrepôts, et connecte et déconnecte les utilisateurs.

### Tier C : maîtrise et passage à l'échelle

**C1. RxJS en profondeur**
- À lire : [`AuthService.login`](src/app/core/auth/auth-service.ts) (`switchMap`, `tap`) et `refresh`
  (`map`, `catchError`).
- À faire (`TODO(C1)`) :
  - La recherche avec debounce dans [`ProductsPage`](src/app/features/products/product-list/products-page.ts) :
    `toObservable`, `debounceTime`, `distinctUntilChanged`, `takeUntilDestroyed`.
  - Le refresh sur 401 dans [l'intercepteur](src/app/core/auth/auth-interceptor.ts), avec un seul refresh partagé.
  - `toSignal(form.valueChanges)` dans [`MovementForm`](src/app/features/movements/movement-form.ts).

**C2. Formulaires réactifs**
- À lire :
  - [`categories-page.ts`](src/app/features/categories/categories-page.ts) et
    [`categories-page.html`](src/app/features/categories/categories-page.html) : `FormGroup`, un validateur
    personnalisé, les erreurs du serveur avec `setErrors`.
  - Le champ `username` commenté de [`register-page.html`](src/app/features/auth/register-page.html).
- À faire (`TODO(C2)`) :
  - Les validateurs de [l'inscription](src/app/features/auth/register-page.ts) et
    [`passwordsMatch`](src/app/features/auth/passwords-match.ts) (réactive
    [son test](src/app/features/auth/passwords-match.spec.ts)).
  - [`ProductFormPage`](src/app/features/products/product-form/product-form-page.ts) : validateurs, `patchValue`,
    contrôle du stock désactivé, gestion des 400 et 409.
  - [`MovementForm`](src/app/features/movements/movement-form.ts) : un validateur de groupe et l'envoi.
  - La modale des [entrepôts](src/app/features/warehouses/warehouses-page.ts).

**C3. Détection de changement (zoneless, OnPush)**
- Déjà vrai dans ce projet :
  - Il est zoneless : pas de `zone.js` dans [`package.json`](package.json), pas de `provideZoneChangeDetection()`
    dans [`app.config.ts`](src/app/app.config.ts).
  - En Angular 22, les composants sont **OnPush par défaut**. L'ancien comportement par défaut s'appelle
    maintenant `ChangeDetectionStrategy.Eager`.
- À faire :
  - Profile une navigation avec Angular DevTools.
  - Dans un composant, modifie un champ simple depuis un `setTimeout` : la vue ne se met pas à jour.
    Transforme-le en signal : elle se met à jour. Explique ensuite pourquoi un gestionnaire de clic qui modifie
    un champ simple met *bien* la vue à jour.
  - Mets `changeDetection: ChangeDetectionStrategy.Eager` sur un composant et compare dans le profiler.

**C4. Architecture, performance, tests**
- À lire :
  - Les [règles de dossiers](#architecture) ci-dessus.
  - Les routes lazy, et la sortie de `npm run build` face aux budgets de [`angular.json`](angular.json).
  - [`categories-api.spec.ts`](src/app/features/categories/categories-api.spec.ts) : un test de service avec
    `HttpTestingController`.
  - [`pagination.spec.ts`](src/app/shared/ui/pagination.spec.ts) : un test de composant avec `setInput` et les outputs.
- À faire (`TODO(C4)`) :
  - `@defer (on viewport)` autour du graphique du [tableau de bord](src/app/features/dashboard/dashboard-page.html),
    et vérifie qu'il obtient son propre chunk lazy.
  - Un test de `ProductsApi.paged` (voir le TODO de
    [`categories-api.spec.ts`](src/app/features/categories/categories-api.spec.ts)).
  - Un test du composant [`StockBadge`](src/app/shared/inventory/stock-badge.ts) (crée `stock-badge.spec.ts` à côté).
  - Réactive tous les tests restants.

## Ajouts par rapport au PDF

Ces notions comptent en Angular 22 et apparaissent dans le code :
- **API Resource** (`resource`, `rxResource`, `httpResource`) : stable depuis la 22.0. Chaque page charge ses
  données avec `rxResource`, par exemple [`categories-page.ts`](src/app/features/categories/categories-page.ts).
  - Exercice : remplace une `rxResource` par `httpResource<Category[]>(() => url)` et compare.
- **`linkedSignal`** : un signal modifiable qui se réinitialise à partir d'une source
  ([`products-page.ts`](src/app/features/products/product-list/products-page.ts)).
- **`@let`** : une variable de template ([`dashboard-page.html`](src/app/features/dashboard/dashboard-page.html)).
- **Projection de contenu** (`ng-content`, `select`) et **requêtes signal** (`viewChild`) :
  [`page-head.ts`](src/app/shared/ui/page-head.ts), [`modal.ts`](src/app/shared/ui/modal.ts).
- **Intercepteurs** ([`auth-interceptor.ts`](src/app/core/auth/auth-interceptor.ts)), **`InjectionToken`**
  ([`api-base-url.ts`](src/app/core/api/api-base-url.ts)), **`provideAppInitializer`**
  ([`app.config.ts`](src/app/app.config.ts)).
- **Environnements** avec `fileReplacements` ([`src/environments/`](src/environments), [`angular.json`](angular.json)).
- **`withComponentInputBinding`** ([`app.config.ts`](src/app/app.config.ts)), et le `title` des routes
  ([`app.routes.ts`](src/app/app.routes.ts)).
- **Données de locale** : `registerLocaleData`, `LOCALE_ID`, `DEFAULT_CURRENCY_CODE`
  ([`app.config.ts`](src/app/app.config.ts)).
- **Signal Forms** : le PDF les dit expérimentaux, mais `form()` de `@angular/forms/signals` fait partie de l'API
  publique depuis la 22.0.
  - Exercice facultatif une fois C2 terminé : réécris la modale des
    [catégories](src/app/features/categories/categories-page.html) avec les Signal Forms.

## Ce qui manque encore par rapport à l'application React

Ces parties ont été laissées hors du squelette. Chacune fait un bon exercice après C4 ; le lien mène à la version
React qui sert de référence :
- Les compteurs de produits dans la barre latérale, et le menu déroulant de l'utilisateur
  ([`AppShell.tsx`](../Inventory_React/src/components/layout/AppShell.tsx)).
- Les données sur 7 jours du graphique du tableau de bord
  ([`DashboardPage.tsx`](../Inventory_React/src/pages/DashboardPage.tsx),
  [`StockChart.tsx`](../Inventory_React/src/components/StockChart.tsx)).
- Un choix du produit dans le formulaire de mouvement, pour enregistrer un mouvement depuis la page des mouvements
  ([`MovementDrawer.tsx`](../Inventory_React/src/components/MovementDrawer.tsx)).
- L'indicateur de force du mot de passe ([`AuthPages.tsx`](../Inventory_React/src/pages/AuthPages.tsx)), le
  récapitulatif des erreurs de formulaire ([`Form.tsx`](../Inventory_React/src/components/ui/Form.tsx)), et les
  squelettes de chargement ([`States.tsx`](../Inventory_React/src/components/ui/States.tsx)).
- Les étapes C5 et suivantes du PDF (SSR, bibliothèques d'état) sont hors périmètre.
