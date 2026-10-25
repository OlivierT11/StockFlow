import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { errorMessage, fieldErrors } from '../../core/api/api-error';
import { Category } from '../../core/api/api-models';
import { AuthService } from '../../core/auth/auth-service';
import { ToastService } from '../../core/notifications/toast-service';
import { stockState } from '../../shared/inventory/stock-state';
import { EmptyState } from '../../shared/ui/empty-state';
import { ErrorBanner } from '../../shared/ui/error-banner';
import { Icon } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { PageHead } from '../../shared/ui/page-head';
import { ProductsApi } from '../products/products-api';
import { CategoriesApi } from './categories-api';

interface CategoryRow extends Category {
  /** undefined while the products are loading (or failed to load). */
  count?: number;
  low?: number;
  value?: number;
}

/**
 * EXEMPLE COMMENTÉ : une page CRUD complète. Lis-la avant les exercices, puis refais la même page pour les
 * entrepôts (features/warehouses). Elle montre, sur un cas réel :
 *   - le chargement des données avec rxResource, et les états chargement / erreur / vide,
 *   - la dérivation des données d'affichage avec computed(),
 *   - un formulaire réactif dans une modale, avec un validateur personnalisé et les erreurs du serveur,
 *   - une confirmation avant une action destructive, des toasts, et reload() après une écriture,
 *   - des actions d'administration montrées aux seuls admins.
 */
@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, PageHead, EmptyState, ErrorBanner, Modal, Icon],
  templateUrl: './categories-page.html',
})
export class CategoriesPage {
  private readonly api = inject(CategoriesApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  // LEARN(B4) : rxResource transforme un appel qui renvoie un Observable en signals : value(), hasValue(),
  // isLoading(), error(), et reload() pour recharger. Il s'abonne à ta place et annule une requête en cours
  // quand le composant est détruit : pas de subscribe(), pas d'unsubscribe, pas de fuite.
  // Attention : value() LÈVE UNE ERREUR quand la ressource est en erreur : teste d'abord error() ou hasValue().
  protected readonly categories = rxResource({ stream: () => this.api.list() });
  protected readonly products = rxResource({ stream: () => this.productsApi.all() });

  // LEARN(B2) : computed() combine les deux ressources ; il se recalcule dès que l'une d'elles reçoit une nouvelle valeur.
  protected readonly rows = computed<CategoryRow[]>(() => {
    if (!this.categories.hasValue()) return [];
    const products = this.products.hasValue() ? this.products.value() : undefined;
    return this.categories.value().map((category) => {
      const own = products?.filter((p) => p.categoryId === category.id);
      return {
        ...category,
        count: own?.length,
        low: own?.filter((p) => stockState(p) !== 'ok').length,
        value: own?.reduce((sum, p) => sum + p.price * p.stock, 0),
      };
    });
  });

  /** Category of the edit modal: null for a new one, undefined when the modal is closed. */
  protected readonly editing = signal<Category | null | undefined>(undefined);
  protected readonly toDelete = signal<CategoryRow | null>(null);
  protected readonly saving = signal(false);

  // LEARN(C2) : un FormGroup avec un seul contrôle. Les validateurs s'exécutent à chaque changement ; le template
  // lit form.controls.name.errors pour afficher le message.
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), this.uniqueName()],
    }),
  });

  protected openEditor(category: Category | null): void {
    this.form.reset({ name: category?.name ?? '' });
    this.editing.set(category);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const editing = this.editing();
    const name = this.form.controls.name.value.trim();
    const request: Observable<unknown> = editing ? this.api.update(editing.id, name) : this.api.create(name);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(undefined);
        this.toast.success(editing ? 'Catégorie modifiée' : 'Catégorie créée', name);
        this.categories.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        // LEARN(C2) : un 400 de l'API s'affiche exactement comme une erreur côté client, sur le contrôle lui-même.
        const serverMessage = fieldErrors(err)['name'];
        if (serverMessage) this.form.controls.name.setErrors({ server: serverMessage });
        else this.toast.error('Enregistrement impossible', errorMessage(err));
      },
    });
  }

  protected confirmDelete(row: CategoryRow): void {
    this.toDelete.set(null);
    this.api.remove(row.id).subscribe({
      next: () => {
        this.toast.success('Catégorie supprimée', row.name);
        this.categories.reload();
      },
      // 409 when a product was attached meanwhile: the API explains it in its `detail`.
      error: (err: unknown) => this.toast.error('Suppression refusée', errorMessage(err)),
    });
  }

  // LEARN(C2) : un validateur personnalisé. C'est une closure, il peut donc lire la liste actuelle des catégories.
  private uniqueName(): ValidatorFn {
    return (control) => {
      const name = String(control.value).trim().toLowerCase();
      const others = this.categories.hasValue() ? this.categories.value() : [];
      const taken = others.some((c) => c.name.toLowerCase() === name && c.id !== this.editing()?.id);
      return taken ? { duplicate: true } : null;
    };
  }
}
