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

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();

    console.log('🔍 INTERCEPTOR APPELÉ - Requête vers:', request.url);
    console.log('🔍 Token trouvé:', token ? 'OUI (longueur: ' + token.length + ')' : 'NON');

    // Add JWT token and CORS headers to request
    let headers = request.headers
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json');

    if (token) {
      const authHeader = `Bearer ${token}`;
      headers = headers.set('Authorization', authHeader);
      console.log('✅ Header Authorization ajouté:', authHeader.substring(0, 50) + '...');
    } else {
      console.warn('⚠️ Aucun token trouvé - requête sans authentification');
    }

    request = request.clone({ headers });

    console.log('📤 Headers finaux envoyés:', {
      'Content-Type': request.headers.get('Content-Type'),
      'Accept': request.headers.get('Accept'),
      'Authorization': request.headers.get('Authorization')?.substring(0, 50) + '...'
    });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Erreur HTTP:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message
        });

        // Handle 401 Unauthorized errors
        if (error.status === 401) {
          console.error('🚫 Authentification échouée - redirection vers login');
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}
