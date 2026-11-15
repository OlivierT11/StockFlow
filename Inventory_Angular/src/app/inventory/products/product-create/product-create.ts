import { Component, inject, Output, EventEmitter, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { API_BASE_URL } from '../../../shared/api-base-url';
import { ProductsApi } from '../services/products-api';

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-product-create-page',
  imports: [ReactiveFormsModule],
  templateUrl: './product-create.html'
})
export class ProductCreate {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly productsApi = inject(ProductsApi);

  // Événement émis lorsque le formulaire est soumis avec succès ou lorsque l'utilisateur annule la création du produit.
  @Output() close = new EventEmitter<void>();

  @Output() produitCree = new EventEmitter<void>();

  categories: Category[] = [];
  submitted = false;

  readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    categoryId: ['', Validators.required],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    initialStock: [0, [Validators.required, Validators.min(0)]],
    lowStockThreshold: [10, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.http.get<Category[]>(`${API_BASE_URL}/categories`).subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des catégories :', error);
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.productForm.invalid) {
      // Marque tous les champs comme touchés pour afficher les messages d'erreur.
      // Ça permet de montrer les erreurs de validation même si l'utilisateur n'a pas touché tous les champs.
      this.productForm.markAllAsTouched();
      return;
    }

    const product = this.productForm.getRawValue();

    const payload = {
      ...product,
      categoryId: Number(product.categoryId),
      price: Number(product.unitPrice),
      stock: Number(product.initialStock),
      lowStockThreshold: Number(product.lowStockThreshold),
    };

    this.productsApi.createProduct(payload).subscribe({
      next: (createdProduct) => {
        console.log('Produit créé :', createdProduct);
        this.close.emit();
        this.produitCree.emit(); // Émet l'événement pour notifier que le produit a été créé avec succès.
      },
      error: (error) => {
        console.error('Erreur lors de la création du produit :', error);
      }
    });

    // Après création réussie :
    // this.router.navigate(['/products']);
    this.cancel();
  }

  cancel(): void {
    this.close.emit();
  }

  showError(field: keyof typeof this.productForm.controls): boolean {
    // Vérifie si le champ est invalide et a été touché ou si le formulaire a été soumis.
    const control = this.productForm.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }
}
