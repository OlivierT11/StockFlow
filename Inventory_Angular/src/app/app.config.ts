import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth-interceptor';
import { AuthService } from './core/auth/auth-service';

// LEARN(A3) : les pipes date, currency et number formatent selon LOCALE_ID ; ses données doivent d'abord être enregistrées.
registerLocaleData(localeFr);

/**
 * LEARN(A1) : les providers de toute l'application, lus une fois par bootstrapApplication() dans main.ts.
 * Pas de zone.js ni de provideZoneChangeDetection() : depuis Angular 21 les applications sont zoneless par
 * défaut, et en Angular 22 les composants utilisent la stratégie OnPush par défaut (étape C3).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // LEARN(B5) : withComponentInputBinding() relie les paramètres de route, les query params et les data de route
    // aux inputs de même nom du composant (ProductDetailPage.id, ProductsPage.page, LoginPage.returnUrl).
    provideRouter(routes, withComponentInputBinding()),
    // LEARN(B4) : rend HttpClient injectable. Les intercepteurs s'exécutent à chaque requête (ajout du jeton bearer).
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' },
    // LEARN(B3) : Angular attend cet Observable avant la première navigation : les guards savent donc déjà
    // si la session enregistrée est valide.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
