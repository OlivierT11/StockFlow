import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cross-field validator of the registration form, set on the FormGroup (not on one control):
 *   this.fb.group({ …, password: [''], confirm: [''] }, { validators: passwordsMatch })
 *
 * TODO(C2) : renvoie { passwordsMismatch: true } quand les valeurs `password` et `confirm` du groupe diffèrent,
 * null quand elles sont égales. Lis les enfants avec group.get('password')?.value.
 * Retire ensuite `.skip` dans passwords-match.spec.ts.
 *
 * LEARN(C2) : un validateur n'est qu'une fonction (control) => errors | null. Renvoyer null veut dire « valide ».
 */
export const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => null;
