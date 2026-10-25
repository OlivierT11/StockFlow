import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';

/**
 * Signed-in area: anonymous visitors go to /login, and come back to the page they asked for afterwards.
 *
 * LEARN(B5) : un guard fonctionnel renvoie true (continuer), false (rester) ou un UrlTree (rediriger). Il
 * s'exécute dans un contexte d'injection, il peut donc inject() des services. Pas d'état « chargement » à gérer
 * ici : la session a déjà été vérifiée par provideAppInitializer (app.config.ts) avant la première navigation.
 */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isLoggedIn() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

// TODO(B5) : un utilisateur connecté n'a rien à faire sur /login et /inscription : redirige-le vers '/'.
export const guestGuard: CanActivateFn = () => true;

// TODO(B5) : la création et la modification de produits sont réservées aux admins. Renvoie true pour un admin
// (AuthService.isAdmin, étape B2), sinon redirige vers '/interdit' (ForbiddenPage). L'API répond 403 de toute
// façon : le guard sert l'expérience utilisateur, ce n'est jamais une mesure de sécurité.
export const adminGuard: CanActivateFn = () => true;
