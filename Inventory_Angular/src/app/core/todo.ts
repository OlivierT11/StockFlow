import { Observable, throwError } from 'rxjs';

/** Thrown by the exercise stubs. Pages show its message, so the UI tells you what is left to implement. */
export class TodoError extends Error {
  constructor(step: string, what: string) {
    super(`À implémenter : ${what} — TODO(${step})`);
    this.name = 'TodoError';
  }
}

/**
Pour l’attraper :

try {
  // code
} catch (error) {
  if (error instanceof TodoError) {
    console.error(error.message);
  }
}

*/

/**
 * Stub for an exercise method that returns an Observable: it fails at once with a TodoError.
 * Replace the call with the real implementation.
 *
 * LEARN(B1) : `<T>` est un paramètre de type générique. Rien dans les arguments ne dit ce qu'est T : TypeScript
 * le déduit de l'endroit où va le résultat. Dans `get(): Observable<Product> { return todo(...) }`, T vaut Product.
 */
export function todo<T>(step: string, what: string): Observable<T> {
  return throwError(() => new TodoError(step, what));
}
