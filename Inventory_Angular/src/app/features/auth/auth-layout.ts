import { Component } from '@angular/core';
import { Icon } from '../../shared/ui/icon';

/** Two-column frame of the login and registration pages; the form is projected into the card. */
@Component({
  selector: 'app-auth-layout',
  imports: [Icon],
  template: `
    <div class="auth">
      <aside class="auth-side">
        <div class="brand">
          <span class="brand-mark"><app-icon name="package" /></span>
          <span class="brand-name">Inventory</span>
        </div>
        <div>
          <h1>Le stock de l’atelier, à jour et sous contrôle.</h1>
          <p>Produits, seuils d’alerte, entrées et sorties par entrepôt : une seule application pour toute l’équipe.</p>
          <ul>
            <li><app-icon name="check-circle" />Tableau de bord des stocks sous seuil</li>
            <li><app-icon name="check-circle" />Journal des mouvements horodaté</li>
            <li><app-icon name="check-circle" />Rôles User et Admin</li>
          </ul>
        </div>
        <span class="side-foot">Application interne · API ASP.NET Core</span>
      </aside>
      <div class="auth-main">
        <div class="auth-card"><ng-content /></div>
      </div>
    </div>
  `,
})
export class AuthLayout {}
