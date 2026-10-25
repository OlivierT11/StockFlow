import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth-service';
import { TokenStorage } from './token-storage';

/**
 * Adds the bearer token to API requests, and reacts to 401 responses.
 *
 * LEARN(B4) : un intercepteur fonctionnel voit chaque requête HttpClient (enregistré avec withInterceptors()
 * dans app.config.ts). Les requêtes sont immuables : clone()-les pour changer un en-tête. `next(req)` renvoie
 * la réponse sous forme d'Observable, que l'intercepteur peut transformer avec des opérateurs RxJS.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorage);
  const auth = inject(AuthService);

  // Login, register and refresh are anonymous: no bearer, and a 401 there is not an expired session.
  if (req.url.includes('/api/v1/auth/') && !req.url.endsWith('/logout')) return next(req);

  const withToken = (request: HttpRequest<unknown>) => {
    const access = tokens.access;
    return access ? request.clone({ setHeaders: { Authorization: `Bearer ${access}` } }) : request;
  };

  return next(withToken(req)).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // TODO(C1) : le jeton d'accès ne vit que 15 minutes. Au lieu d'abandonner tout de suite :
        //   1. appelle auth.refresh() (il émet true ou false),
        //   2. si true, renvoie la requête avec le nouveau jeton : next(withToken(req)),
        //   3. si false, marque la session comme expirée et relance l'erreur d'origine.
        // Opérateurs : switchMap, throwError. Bonus : quand plusieurs requêtes échouent en même temps, fais-leur
        // partager UN SEUL appel de refresh (garde l'Observable du refresh en cours dans AuthService, avec shareReplay(1)).
        auth.sessionExpired.set(true);
      }
      return throwError(() => err);
    }),
  );
};
