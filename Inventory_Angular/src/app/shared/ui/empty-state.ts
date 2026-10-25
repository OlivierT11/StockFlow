import { Component, input } from '@angular/core';
import { Icon, IconName } from './icon';

/** "Nothing here" block of a list. Buttons placed between the tags are projected as its actions. */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="empty">
      <span class="empty-icon"><app-icon [name]="icon()" /></span>
      <h3>{{ title() }}</h3>
      <p>{{ text() }}</p>
      <div class="empty-actions"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly text = input('');
}
