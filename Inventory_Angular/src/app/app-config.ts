import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { JwtInterceptor } from './auth/jwt.interceptor';

// Application configuration for the Angular application
export const appConfig: ApplicationConfig = {
  providers: [
    // Provide global error listeners for the browser environment
    provideBrowserGlobalErrorListeners(),
    // Provide the router with the defined routes
    provideRouter(routes),
    // Provide the HTTP client with interceptors from dependency injection
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
  ],
};
