import { Product } from '../../core/api/api-models';

export type StockState = 'ok' | 'low' | 'out';

/**
 * TODO(B1) : même règle que l'API :
 *   - 'out' quand le stock vaut 0,
 *   - 'low' quand il est inférieur ou égal à lowStockThreshold,
 *   - 'ok' sinon.
 * Retire ensuite `.skip` dans stock-state.spec.ts et lance `npm test` : les tests sont déjà écrits.
 *
 * LEARN(B1) : `Pick<Product, 'stock' | 'lowStockThreshold'>` accepte tout objet qui a ces deux champs : la
 * fonction marche pour un Product, mais aussi pour une valeur de formulaire ou un littéral de test.
 */
export function stockState(product: Pick<Product, 'stock' | 'lowStockThreshold'>): StockState {
  return 'ok';
}
