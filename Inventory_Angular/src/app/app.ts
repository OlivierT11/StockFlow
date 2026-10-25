import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './core/notifications/toast-container';

/**
 * LEARN(A1) : le composant racine, démarré par main.ts dans le <app-root> de index.html.
 * Il ne contient que le router outlet (les pages) et les toasts ; tout le reste vit dans les composants routés.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  template: `
    <router-outlet />
    <app-toast-container />
  `,
})
export class App {}
