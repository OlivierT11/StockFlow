import { Component, inject, Output, EventEmitter, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { API_BASE_URL } from '../../../shared/api-base-url';
import { StockMovementsApi } from '../services/stock-movements-api';
import { ProductsApi } from '../../products/services/products-api';
import { WarehousesApi } from '../../warehouses/services/warehouses-api';

interface Product {
  id: number;
  name: string;
}

interface Warehouse {
  id: string | number;
  name: string;
}

@Component({
  selector: 'app-stock-movement-create-page',
  imports: [ReactiveFormsModule],
  templateUrl: './stock-movement-create.html'
})
export class StockMovementCreate implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly stockMovementsApi = inject(StockMovementsApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly warehousesApi = inject(WarehousesApi);

  @Output() close = new EventEmitter<void>();
  @Output() mouvementCree = new EventEmitter<void>();

  products: Product[] = [];
  warehouses: Warehouse[] = [];

  readonly movementTypes = [
    { value: 'in', label: 'Entrée' },
    { value: 'out', label: 'Sortie' },
    { value: 'adjustment', label: 'Ajustement' },
  ];

  submitted = false;

  readonly movementForm = this.fb.nonNullable.group({
    productId: ['', Validators.required],
    warehouseId: ['', Validators.required],
    type: ['', Validators.required],
    quantity: [0, [Validators.required, Validators.min(1)]],
    reference: ['', Validators.maxLength(100)],
  });

  ngOnInit(): void {
    this.productsApi.getAll().subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits :', error);
      }
    });

    this.warehousesApi.getAll().subscribe({
      next: (warehouses) => {
        this.warehouses = warehouses;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des entrepôts :', error);
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    const movement = this.movementForm.getRawValue();

    const payload = {
      productId: Number(movement.productId),
      warehouseId: Number(movement.warehouseId),
      type: movement.type as 'in' | 'out' | 'adjustment',
      quantity: Number(movement.quantity),
      reference: movement.reference || undefined,
    };

    this.stockMovementsApi.createStockMovement(payload).subscribe({
      next: (createdMovement) => {
        console.log('Mouvement de stock créé :', createdMovement);
        this.close.emit();
        this.mouvementCree.emit();
      },
      error: (error) => {
        console.error('Erreur lors de la création du mouvement de stock :', error);
      }
    });

    this.cancel();
  }

  cancel(): void {
    this.close.emit();
  }

  showError(field: keyof typeof this.movementForm.controls): boolean {
    const control = this.movementForm.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }
}
