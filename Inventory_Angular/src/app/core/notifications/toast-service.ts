import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

/** Success / error notifications, shown top right by ToastContainer (mounted once in app.html). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(title: string, message?: string): void {
    this.show('success', title, message);
  }

  error(title: string, message?: string): void {
    this.show('error', title, message);
  }

  show(kind: ToastKind, title: string, message?: string): void {
    const toast: Toast = { id: this.nextId++, kind, title, message };
    // LEARN(B2) : update() calcule la valeur suivante à partir de la valeur courante. Renvoie toujours un NOUVEAU
    // tableau : un signal compare les valeurs avec Object.is, un push dans le même tableau ne préviendrait personne.
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), kind === 'error' ? 8000 : 4500);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
