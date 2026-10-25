import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../core/notifications/toast-service';
import { Icon } from '../../../shared/ui/icon';
import { PageHead } from '../../../shared/ui/page-head';
import { CategoriesApi } from '../../categories/categories-api';
import { ProductsApi } from '../products-api';

/**
 * Création (/produits/nouveau) et modification (/produits/:id/modifier) d'un produit : un composant, deux routes.
 * EXERCICE (étape C2) : un formulaire réactif de niveau production.
 */
@Component({
  selector: 'app-product-form-page',
  imports: [ReactiveFormsModule, RouterLink, PageHead, Icon],
  templateUrl: './product-form-page.html',
})
export class ProductFormPage implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ProductsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** The :id parameter on /produits/:id/modifier; undefined on /produits/nouveau. */
  readonly id = input<string>();
  protected readonly editing = computed(() => this.id() !== undefined);

  protected readonly categories = rxResource({ stream: () => this.categoriesApi.list() });

  protected readonly form = this.fb.group({
    // Exemple commenté : les validateurs intégrés d'un contrôle.
    name: ['', [Validators.required, Validators.maxLength(100)]],
    // TODO(C2) : required.
    categoryId: this.fb.control<number | null>(null),
    // TODO(C2) : required, min(0), au plus 2 décimales (Validators.pattern(/^\d+(\.\d{1,2})?$/) ou un validateur
    // personnalisé).
    price: [0],
    // TODO(C2) : required, entier >= 0. Seulement à la création : ensuite le stock ne change que par les mouvements.
    stock: [0],
    // TODO(C2) : required, entier >= 0.
    lowStockThreshold: [10],
  });

  protected readonly saving = signal(false);
  /** Set on a 409: someone changed the product meanwhile. */
  protected readonly conflict = signal(false);

  // LEARN(B6) : ngOnInit s'exécute une fois, après qu'Angular a défini les inputs pour la première fois. Dans le
  // constructeur, this.id() vaudrait encore undefined. (Avec les signals, un effect() ou une ressource remplace
  // souvent ngOnInit. Son pendant ngOnDestroy est surtout remplacé par takeUntilDestroyed() / DestroyRef.)
  ngOnInit(): void {
    // TODO(C2) : en mode modification :
    //   - désactive le contrôle du stock : this.form.controls.stock.disable() (les contrôles désactivés sont exclus
    //     de form.value — utilise getRawValue() quand tu en as besoin),
    //   - charge le produit avec this.api.get(Number(this.id())) (étape B4) et remplis le formulaire :
    //     patchValue(product). L'Observable se termine après une réponse, subscribe() n'a donc pas besoin de
    //     nettoyage ici.
  }

  // TODO(C2) : envoi
  //   1. invalide → this.form.markAllAsTouched() et arrête-toi ;
  //   2. création → api.create({...}) puis navigue vers ['/produits', created.id] ;
  //      modification → api.update({ id, ... }) puis navigue vers la page de détail ; un toast dans les deux cas ;
  //   3. en cas d'erreur : 400 → place fieldErrors(err) sur les contrôles avec setErrors({ server: message })
  //      (voir CategoriesPage.save), 409 → this.conflict.set(true), sinon un toast avec errorMessage(err).
  protected submit(): void {
    this.toast.show('info', 'À implémenter — TODO(C2)', 'ProductFormPage.submit()');
  }

  protected cancel(): void {
    this.router.navigateByUrl(this.editing() ? `/produits/${this.id()}` : '/produits');
  }
}
