import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MovementType, Product, StockMovement } from '../../core/api/api-models';
import { ToastService } from '../../core/notifications/toast-service';
import { Modal } from '../../shared/ui/modal';
import { WarehousesApi } from '../warehouses/warehouses-api';

/**
 * Records a stock movement (In / Out / Adjustment) for one product, in a modal.
 * Used by ProductDetailPage: `<app-movement-form [product]="p" [open]="…" (closed)="…" (saved)="…" />`.
 */
@Component({
  selector: 'app-movement-form',
  imports: [ReactiveFormsModule, DecimalPipe, Modal],
  templateUrl: './movement-form.html',
})
export class MovementForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly warehousesApi = inject(WarehousesApi);
  private readonly toast = inject(ToastService);

  readonly product = input.required<Product>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<StockMovement>();

  protected readonly types: { value: MovementType; label: string }[] = [
    { value: 'In', label: 'Entrée' },
    { value: 'Out', label: 'Sortie' },
    { value: 'Adjustment', label: 'Ajustement' },
  ];

  protected readonly warehouses = rxResource({ stream: () => this.warehousesApi.list() });

  protected readonly form = this.fb.group({
    warehouseId: this.fb.control<number | null>(null, Validators.required),
    type: this.fb.control<MovementType>('In'),
    // TODO(C2) : In et Out demandent un entier positif ; un Adjustment un entier signé non nul. Écris un validateur
    // personnalisé sur le groupe (il a besoin de `type` et de `quantity`), comme passwordsMatch.
    quantity: [1, Validators.required],
    notes: ['', Validators.maxLength(250)],
  });

  protected readonly saving = signal(false);

  // TODO(C1) : le formulaire n'est pas un signal, computed() ne peut donc pas le voir changer. Fais le pont :
  //   private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  // TODO(B2) : calcule ensuite le stock après le mouvement à partir de product() et value() :
  //   In → stock + quantité · Out → stock − quantité · Adjustment → stock + quantité (signée).
  // Le template l'affiche déjà, et bloque l'envoi quand il est négatif (l'API répondrait 422).
  protected readonly stockAfter = computed(() => this.product().stock);

  // TODO(B4, C2) : à l'envoi : markAllAsTouched() si invalide ; sinon MovementsApi.create({ productId, ... }),
  // puis un toast, this.form.reset() et this.saved.emit(movement). En cas d'erreur, un toast avec errorMessage(err).
  protected submit(): void {
    this.toast.show('info', 'À implémenter — TODO(B4, C2)', 'MovementForm.submit()');
  }
}
