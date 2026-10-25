import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';

/**
 * "1–10 sur 42 produits", page buttons and an optional page size select.
 *
 * LEARN(B3) : un composant de présentation (« dumb »). Il reçoit tout par input() et signale les actions de
 * l'utilisateur par output(). Il n'appelle jamais d'API et ne change pas l'URL : son parent (la page « smart »)
 * décide de ce que veut dire un changement de page. Il est donc réutilisable et facile à tester (voir pagination.spec.ts).
 */
@Component({
  selector: 'app-pagination',
  imports: [Icon, DecimalPipe],
  template: `
    <nav class="pagination" aria-label="Pagination">
      <span class="pg-total">
        @if (total()) {
          {{ from() }}–{{ to() }} sur {{ total() | number }} {{ noun() }}{{ total() > 1 ? 's' : '' }}
        } @else {
          Aucun résultat
        }
      </span>
      @if (sizes().length) {
        <label class="pg-size">
          <span class="small muted">Par page</span>
          <!-- LEARN(A2) : $event est l'événement DOM ; $any() fait taire le contrôle de types du template pour event.target. -->
          <select class="select" aria-label="Éléments par page" (change)="sizeChange.emit(+$any($event.target).value)">
            @for (s of sizes(); track s) {
              <option [value]="s" [selected]="s === size()">{{ s }}</option>
            }
          </select>
        </label>
      }
      <div class="pg-pages">
        <button type="button" class="pg-btn" [disabled]="page() <= 1" aria-label="Page précédente" (click)="pageChange.emit(page() - 1)">
          <app-icon name="chevron-left" />
        </button>
        @for (p of sequence(); track p; let i = $index) {
          @if (i > 0 && p - sequence()[i - 1] > 1) {
            <span class="pg-ellipsis" aria-hidden="true">…</span>
          }
          <button type="button" class="pg-btn" [attr.aria-current]="p === page() ? 'page' : null" [attr.aria-label]="'Page ' + p" (click)="pageChange.emit(p)">
            {{ p }}
          </button>
        }
        <button type="button" class="pg-btn" [disabled]="page() >= pages()" aria-label="Page suivante" (click)="pageChange.emit(page() + 1)">
          <app-icon name="chevron-right" />
        </button>
      </div>
    </nav>
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly total = input.required<number>();
  readonly size = input.required<number>();
  /** Singular noun of the counted items ("produit"). */
  readonly noun = input('élément');
  /** Choices of the page size select; no select when empty. */
  readonly sizes = input<number[]>([]);

  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();

  protected readonly from = computed(() => (this.page() - 1) * this.size() + 1);
  protected readonly to = computed(() => Math.min(this.page() * this.size(), this.total()));

  /** First two, last two and the neighbours of the current page. */
  protected readonly sequence = computed(() => {
    const page = this.page();
    const pages = this.pages();
    const seq = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((p) => p >= 1 && p <= pages));
    return [...seq].sort((a, b) => a - b);
  });
}
