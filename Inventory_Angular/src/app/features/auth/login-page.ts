import { Component, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage, httpStatus } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth-service';
import { Icon } from '../../shared/ui/icon';
import { AuthLayout } from './auth-layout';

/**
 * Exemple commenté d'un formulaire *template-driven* (étape B6) : le template porte le modèle du formulaire via
 * ngModel, la classe ne garde que les valeurs (dans des signals) et gère l'envoi.
 * Compare avec RegisterPage, qui utilise un formulaire réactif (étape C2).
 */
@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, AuthLayout, Icon],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // LEARN(B5) : authGuard redirige ici avec ?returnUrl=/produits/42. withComponentInputBinding()
  // (app.config.ts) relie ce query param à cet input, parce que les noms correspondent.
  readonly returnUrl = input<string>();

  // LEARN(B6) : [(ngModel)]="email" fonctionne avec un WritableSignal : il lit email() et appelle email.set().
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected submit(form: NgForm): void {
    if (form.invalid) {
      // Shows the field errors of fields the user has not visited yet.
      form.control.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email().trim(), this.password()).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() ?? '/'),
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpStatus(err) === 401 ? 'Email ou mot de passe incorrect.' : errorMessage(err));
      },
    });
  }
}
