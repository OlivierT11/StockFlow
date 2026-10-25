import { SignedQtyPipe } from './signed-qty-pipe';

// TODO(A3) : retire `.skip` une fois le pipe implémenté.
// (Intl met une espace fine insécable U+202F entre les milliers en français :   ci-dessous.)
describe.skip('SignedQtyPipe', () => {
  const pipe = new SignedQtyPipe();

  it('adds a plus sign to positive values', () => {
    expect(pipe.transform(5)).toBe('+5');
  });

  it('uses the minus sign U+2212 for negative values', () => {
    expect(pipe.transform(-3)).toBe('−3');
  });

  it('formats thousands the French way', () => {
    expect(pipe.transform(1500)).toBe('+1 500');
  });

  it('shows zero as +0', () => {
    expect(pipe.transform(0)).toBe('+0');
  });
});
