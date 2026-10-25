import { stockState } from './stock-state';

// LEARN(C4) : une fonction pure est le code le plus simple à tester : pas de TestBed, pas de DOM, juste des
// entrées et des sorties.
// TODO(B1) : retire `.skip` une fois stockState() implémentée.
describe.skip('stockState', () => {
  it('is "out" when the stock is 0', () => {
    expect(stockState({ stock: 0, lowStockThreshold: 10 })).toBe('out');
  });

  it('is "low" at the threshold', () => {
    expect(stockState({ stock: 10, lowStockThreshold: 10 })).toBe('low');
  });

  it('is "ok" above the threshold', () => {
    expect(stockState({ stock: 11, lowStockThreshold: 10 })).toBe('ok');
  });

  it('is "out" rather than "low" when the threshold is 0', () => {
    expect(stockState({ stock: 0, lowStockThreshold: 0 })).toBe('out');
  });
});
