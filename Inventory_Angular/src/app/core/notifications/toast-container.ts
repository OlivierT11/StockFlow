import { Component, inject } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from './toast-service';

const ICONS = { success: 'check-circle', error: 'alert-circle', info: 'info' } as const;

/** Renders ToastService.toasts(). Mounted once, in app.html, so toasts survive navigation. */
@Component({
  selector: 'app-toast-container',
  imports: [Icon],
  template: `
    <div class="toasts" aria-live="polite">
      <!-- LEARN(A2) : @for exige une expression "track" pour qu'Angular reconnaisse les éléments d'un rendu à
           l'autre et n'ajoute / retire que le DOM des toasts qui ont changé. -->
      @for (toast of toastService.toasts(); track toast.id) {
        <div [class]="'toast toast-' + toast.kind" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <app-icon [name]="icons[toast.kind]" />
          <div class="toast-text">
            <span class="toast-title">{{ toast.title }}</span>
            @if (toast.message) {
              <span class="toast-msg">{{ toast.message }}</span>
            }
          </div>
          <button type="button" class="toast-close" aria-label="Fermer la notification" (click)="toastService.dismiss(toast.id)">
            <app-icon name="x" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  // LEARN(A2) : les membres `protected` sont visibles par le template mais pas par les autres classes.
  protected readonly toastService = inject(ToastService);
  protected readonly icons = ICONS;
}
