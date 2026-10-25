import { TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

// LEARN(C4) : un test de composant. TestBed compile le composant, setInput() joue le rôle du parent,
// et on interroge le DOM rendu tel qu'un utilisateur le verrait.
describe('Pagination', () => {
  async function render(inputs: { page: number; pages: number; total: number; size: number }) {
    const fixture = TestBed.createComponent(Pagination);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.componentRef.setInput('noun', 'produit');
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the range of the current page', async () => {
    const { el } = await render({ page: 2, pages: 5, total: 42, size: 10 });
    expect(el.querySelector('.pg-total')?.textContent).toContain('11–20 sur 42 produits');
  });

  it('emits the next page when "Page suivante" is clicked', async () => {
    const { fixture, el } = await render({ page: 2, pages: 5, total: 42, size: 10 });
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => emitted.push(p));

    el.querySelector<HTMLButtonElement>('[aria-label="Page suivante"]')!.click();

    expect(emitted).toEqual([3]);
  });

  it('disables "Page précédente" on the first page', async () => {
    const { el } = await render({ page: 1, pages: 5, total: 42, size: 10 });
    expect(el.querySelector<HTMLButtonElement>('[aria-label="Page précédente"]')!.disabled).toBe(true);
  });
});
