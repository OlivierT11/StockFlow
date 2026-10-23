import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-product-create-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-create.html'
})
export class ProductCreate {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Remplace ces exemples par les catégories chargées depuis ton API.
  readonly categories = [
    { id: 1, name: 'Électronique' },
    { id: 2, name: 'Mobilier' },
    { id: 3, name: 'Fournitures' },
  ];

  submitted = false;

  readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    categoryId: ['', Validators.required],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    initialStock: [0, [Validators.required, Validators.min(0)]],
    lowStockThreshold: [10, [Validators.required, Validators.min(0)]],
  });

  onSubmit(): void {
    this.submitted = true;

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const product = this.productForm.getRawValue();

    // À remplacer par l'appel à ton service/API de création.
    console.log('Nouveau produit :', {
      ...product,
      categoryId: Number(product.categoryId),
      unitPrice: Number(product.unitPrice),
      initialStock: Number(product.initialStock),
      lowStockThreshold: Number(product.lowStockThreshold),
    });

    // Exemple après création réussie :
    // this.router.navigate(['/products']);
  }

  cancel(): void {
    this.router.navigate(['/products']);
  }

  showError(field: keyof typeof this.productForm.controls): boolean {
    const control = this.productForm.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }
}
