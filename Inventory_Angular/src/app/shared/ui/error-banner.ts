import { Component, computed, input, output } from '@angular/core';
import { errorMessage } from '../../core/api/api-error';
import { Icon } from './icon';

/** A failed load, with its French message and a "Réessayer" button: `<app-error-banner [error]="res.error()" (retry)="res.reload()" />` */
@Component({
  selector: 'app-error-banner',
  imports: [Icon],
  template: `
    <div class="banner banner-danger" role="alert">
      <app-icon name="alert-circle" />
      <span class="banner-text"><strong>{{ title() }}</strong> {{ message() }}</span>
      <button type="button" class="btn btn-sm btn-secondary" (click)="retry.emit()">
        <app-icon name="refresh" />Réessayer
      </button>
    </div>
  `,
})
export class ErrorBanner {
  readonly error = input.required<unknown>();
  readonly title = input('Chargement impossible.');
  readonly retry = output<void>();

  protected readonly message = computed(() => errorMessage(this.error()));
}
