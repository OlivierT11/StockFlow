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

    let headers = request.headers
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json');

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // Clone the request with the new headers
    // Clone is necessary because HttpRequest objects are immutable
    request = request.clone({ headers });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }

        return throwError(() => error);
      })
    );
  }
}
