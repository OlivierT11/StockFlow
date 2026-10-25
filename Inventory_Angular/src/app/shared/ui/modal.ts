import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

let nextId = 1;

/**
 * A modal dialog built on the native <dialog> element (focus trap, Escape and backdrop for free).
 *
 *   <app-modal title="Supprimer ?" [open]="isOpen()" (closed)="isOpen.set(false)">
 *     <div class="modal-body">…</div>
 *     <div class="modal-foot">…</div>
 *   </app-modal>
 *
 * LEARN(A2) : <ng-content /> est la *projection de contenu* : ce que le parent met entre les balises est rendu
 * ici. C'est l'équivalent Angular des `children` de React.
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: `
    <dialog #dialog class="modal" [attr.aria-labelledby]="titleId" (close)="closed.emit()">
      <div class="modal-head">
        <h2 [id]="titleId">{{ title() }}</h2>
        <button type="button" class="btn btn-ghost btn-icon" aria-label="Fermer" (click)="dialog.close()">
          <app-icon name="x" />
        </button>
      </div>
      <ng-content />
    </dialog>
  `,
  // LEARN(A3) : les styles d'un composant sont isolés (encapsulation émulée) : Angular ajoute un attribut
  // `_ngcontent-…` aux éléments de ce template et à ces sélecteurs, ils ne peuvent donc pas déborder sur les
  // autres <dialog> de l'application.
  styles: `
    dialog { padding: 0; border: 0; transform: none; color: inherit; }
    dialog:not([open]) { display: none; }
    dialog::backdrop { background: rgba(10, 14, 18, 0.5); }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly open = input(false);
  /** Emitted when the dialog closes: close button, Escape key, or `open` set to false. */
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;

  // LEARN(A2) : viewChild() est une requête signal : elle donne accès à un élément du template de ce composant
  // (ici la variable de référence #dialog).
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // LEARN(B2) : effect() se ré-exécute dès qu'un signal qu'il a lu change. Son rôle : synchroniser des signals
    // avec quelque chose qui n'en est pas un, comme cette API du DOM. Ne t'en sers pas pour copier un signal
    // dans un autre : c'est le rôle de computed() (ou de linkedSignal()).
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      if (!this.open() && dialog.open) dialog.close();
    });
  }
}
