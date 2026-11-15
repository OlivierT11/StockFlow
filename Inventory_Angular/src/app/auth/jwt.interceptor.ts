import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

// JwtInterceptor is provided in the root injector, making it available application-wide
@Injectable()

// JwtInterceptor to add JWT token to outgoing HTTP requests and handle 401 errors
export class JwtInterceptor implements HttpInterceptor {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Intercept outgoing HTTP requests and add JWT token if available
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {

    // Get the JWT token from AuthService
    const token = this.authService.getToken();

    // Start with existing headers or create new ones
    let headers = request.headers;

    // Only set Content-Type and Accept if not already set
    if (!headers.has('Content-Type')) {
      headers = headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('Accept')) {
      headers = headers.set('Accept', 'application/json');
    }

    // Add Authorization header with JWT token
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
      console.debug('[JwtInterceptor] Token ajouté au header Authorization');
    } else {
      console.warn('[JwtInterceptor] Aucun token trouvé dans localStorage');
    }

    // Clone the request with the new headers
    // Clone is necessary because HttpRequest objects are immutable
    request = request.clone({ headers });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('[JwtInterceptor] Erreur HTTP:', error.status, error);

        if (error.status === 401) {
          // Token is invalid or expired
          console.error('[JwtInterceptor] Token invalide ou expiré (401)');
          this.authService.logout();
          this.router.navigate(['/login']);
        }

        if (error.status === 403) {
          // Forbidden - user is authenticated but not authorized
          console.error('[JwtInterceptor] Accès refusé (403). Vérifiez vos permissions. Message du serveur:', error.error);
        }

        return throwError(() => error);
      })
    );
  }
}
