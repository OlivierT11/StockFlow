import { inject, Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})

 // AuthGuard to protect routes that require authentication
export class AuthGuard implements CanActivate {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Check if the user is authenticated before allowing access to the route
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot)
  {
    if (this.authService.isAuthenticated()) {
      return true;
    }

    // If the user is not authenticated, redirect them to the login page
    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }
}
