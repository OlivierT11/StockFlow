import { Component, inject, Output, EventEmitter } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriesApi } from '../services/categories-api';

@Component({
  selector: 'app-category-create-page',
  imports: [ReactiveFormsModule],
  templateUrl: './category-create.html'
})
export class CategoryCreate {
  private readonly fb = inject(FormBuilder);
  private readonly categoriesApi = inject(CategoriesApi);

  @Output() close = new EventEmitter<void>();
  @Output() categorieCree = new EventEmitter<void>();

  submitted = false;

  readonly categoryForm = this.fb.nonNullable.group({
    // Define the form controls with their initial values and validators.
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  onSubmit(): void {
    this.submitted = true;

    if (this.categoryForm.invalid) {
      // Mark all controls as touched to trigger validation messages.
      this.categoryForm.markAllAsTouched(); 
      return;
    }

    const category = this.categoryForm.getRawValue();

    const payload = {
      name: String(category.name),
      description: String(category.description)
    };

    this.categoriesApi.createCategory(payload).subscribe({
      next: (createdCategory) => { // Handle the successful creation of the category.
        console.log('Catégorie créé :', createdCategory);
        this.close.emit();
        this.categorieCree.emit();
      },
      error: (error) => {
        console.error('Erreur lors de la création de la catégorie :', error);
      }
    });

    this.cancel();
  }

  cancel(): void {
    this.close.emit();
  }

  // field is the field in error, and this.categoryForm.controls[field] is the corresponding form control.
  showError(field: keyof typeof this.categoryForm.controls): boolean {
    const control = this.categoryForm.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }
}
