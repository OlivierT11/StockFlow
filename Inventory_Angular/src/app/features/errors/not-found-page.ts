import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'app-not-found-page',
  imports: [EmptyState, RouterLink],
  template: `
    <app-empty-state icon="search" title="Page introuvable (404)" text="L’adresse demandée ne correspond à aucune page de l’application.">
      <a class="btn btn-primary" routerLink="/">Retour au tableau de bord</a>
    </app-empty-state>
  `,
})
export class NotFoundPage {}
