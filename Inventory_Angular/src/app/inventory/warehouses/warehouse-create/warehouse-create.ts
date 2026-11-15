import { Component, inject, Output, EventEmitter } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WarehousesApi } from '../services/warehouses-api';

@Component({
  selector: 'app-warehouse-create-page',
  imports: [ReactiveFormsModule],
  templateUrl: './warehouse-create.html'
})
export class WarehouseCreate {
  private readonly fb = inject(FormBuilder);
  private readonly warehousesApi = inject(WarehousesApi);

  @Output() close = new EventEmitter<void>();
  @Output() entrepotCree = new EventEmitter<void>();

  submitted = false;

  readonly warehouseForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
  });

  onSubmit(): void {
    this.submitted = true;

    if (this.warehouseForm.invalid) {
      this.warehouseForm.markAllAsTouched();
      return;
    }

    const warehouse = this.warehouseForm.getRawValue();

    this.warehousesApi.createWarehouse(warehouse).subscribe({
      next: (createdWarehouse) => {
        console.log('Entrepôt créé :', createdWarehouse);
        this.close.emit();
        this.entrepotCree.emit();
      },
      error: (error) => {
        console.error('Erreur lors de la création de l\'entrepôt :', error);
      }
    });

    this.cancel();
  }

  cancel(): void {
    this.close.emit();
  }

  showError(field: keyof typeof this.warehouseForm.controls): boolean {
    const control = this.warehouseForm.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }
}
