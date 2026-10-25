import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';
import { Icon } from '../../shared/ui/icon';
import { AuthLayout } from './auth-layout';

/**
 * Inscription, avec un formulaire *réactif* (étape C2) : le modèle du formulaire vit dans la classe (FormGroup),
 * le template s'y relie seulement avec [formGroup] / formControlName. Compare avec LoginPage (template-driven).
 * Un nouveau compte reçoit le rôle User.
 */
@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout, Icon],
  templateUrl: './register-page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // LEARN(C2) : avec NonNullableFormBuilder, chaque contrôle revient à sa valeur initiale au reset au lieu de null :
  // form.getRawValue() est donc typé { username: string, email: string, … } sans `| null`.
  private readonly fb = inject(NonNullableFormBuilder);

  // TODO(C2) : ajoute les validateurs (deuxième élément de chaque tableau, depuis Validators) :
  //   username : required, maxLength(50) · email : required, email · password : required, minLength(8)
  //   confirm : required
  // et le validateur de groupe : this.fb.group({ … }, { validators: passwordsMatch }) (./passwords-match.ts).
  protected readonly form = this.fb.group({
    username: [''],
    email: [''],
    password: [''],
    confirm: [''],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal('');

  // TODO(C2) : à l'envoi
  //   1. si this.form.invalid : this.form.markAllAsTouched() (affiche toutes les erreurs) et arrête-toi ;
  //   2. sinon passe loading à true, appelle this.auth.register(username, email, password) (étape B4),
  //      navigue vers '/' en cas de succès, et affiche errorMessage(err) dans error() en cas d'échec.
  protected submit(): void {}
}
