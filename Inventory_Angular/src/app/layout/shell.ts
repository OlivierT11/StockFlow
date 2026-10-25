import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth-service';
import { Icon, IconName } from '../shared/ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

/**
 * Layout of the signed-in area: sidebar, top bar, session banner, and the routed page.
 *
 * LEARN(B5) : ce composant est la route parente de toutes les pages (voir app.routes.ts). Son <router-outlet />
 * affiche la route enfant qui correspond : le shell reste donc à l'écran pendant la navigation.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sidebarOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/produits', label: 'Produits', icon: 'package' },
    { path: '/mouvements', label: 'Mouvements', icon: 'moves' },
    { path: '/categories', label: 'Catégories', icon: 'tag' },
    { path: '/entrepots', label: 'Entrepôts', icon: 'warehouse' },
  ];

  protected logout(): void {
    // LEARN(B4) : un Observable ne fait rien tant qu'on ne s'y abonne pas. Ceux de HttpClient se terminent après
    // une réponse, cet abonnement se nettoie donc tout seul : pas d'unsubscribe (voir l'étape C1 pour les autres).
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/login'));
  }

  protected reconnect(): void {
    const returnUrl = this.router.url;
    this.auth.logout().subscribe(() => this.router.navigate(['/login'], { queryParams: { returnUrl } }));
  }
}
