import { Pipe, PipeTransform } from '@angular/core';

/**
 * `{{ m.delta | signedQty }}`: the signed effect of a movement on the stock.
 *
 * TODO(A3) : formate le nombre avec son signe et les séparateurs de milliers français :
 *   1500 → "+1 500", -3 → "−3" (U+2212 SIGNE MOINS, pas un tiret), 0 → "+0".
 * Indice : new Intl.NumberFormat('fr-FR'), créé une seule fois dans un champ, et Math.abs().
 * Retire ensuite `.skip` dans signed-qty-pipe.spec.ts.
 *
 * LEARN(A3) : un pipe est *pur* par défaut : Angular ne rappelle transform() que quand son entrée change,
 * ce qui coûte moins cher qu'appeler une méthode depuis le template.
 */
@Pipe({ name: 'signedQty' })
export class SignedQtyPipe implements PipeTransform {
  transform(delta: number): string {
    return String(delta);
  }
}
