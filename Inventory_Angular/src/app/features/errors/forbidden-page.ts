import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../shared/ui/empty-state';

/** Target of adminGuard's redirect. */
@Component({
  selector: 'app-forbidden-page',
  imports: [EmptyState, RouterLink],
  template: `
    <app-empty-state icon="lock" title="Accès refusé (403)" text="Cette page est réservée aux administrateurs.">
      <a class="btn btn-primary" routerLink="/">Retour au tableau de bord</a>
    </app-empty-state>
  `,
})
export class ForbiddenPage {}
