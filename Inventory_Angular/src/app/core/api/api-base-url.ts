import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Origin of Inventory_Api, prepended to every request path ('' = same origin).
 *
 * LEARN(B3) : un InjectionToken permet au système d'injection de fournir une valeur qui n'est pas une classe.
 * Les services la lisent avec `inject(API_BASE_URL)` ; un test peut la remplacer par
 * `{ provide: API_BASE_URL, useValue: '' }`. La factory la rend disponible partout sans déclarer de provider
 * dans app.config.ts.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
