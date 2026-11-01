import { tabSort, tabStep } from './focus';

describe('tabSort', () => {
  it('puts declared places first, ascending, and keeps the rest and ties in place', () => {
    const order = { a: undefined, b: 2, c: 1, d: 1, e: undefined } as Record<string, number | undefined>;
    expect(tabSort(Object.keys(order), (k) => order[k])).toEqual(['c', 'd', 'b', 'a', 'e']);
  });
});

describe('tabStep', () => {
  const order = ['a', 'c', 'e'];
  const all = ['a', 'b', 'c', 'd', 'e'];
  const isBefore = (x: string, y: string) => all.indexOf(x) < all.indexOf(y);

  it('steps through the order and runs off either end', () => {
    expect(tabStep(order, 'a', 'next')).toBe('c');
    expect(tabStep(order, 'e', 'next')).toBeNull();
    expect(tabStep(order, 'a', 'prev')).toBeNull();
  });
  it('starts from the first or the last from nothing', () => {
    expect(tabStep(order, null, 'next')).toBe('a');
    expect(tabStep(order, null, 'prev')).toBe('e');
  });
  it('steps from where a target out of the order sits', () => {
    expect(tabStep(order, 'b', 'next', isBefore)).toBe('c');
    expect(tabStep(order, 'b', 'prev', isBefore)).toBe('a');
    expect(tabStep(order, 'd', 'next', isBefore)).toBe('e');
    expect(tabStep(order, 'b', 'next')).toBe('a');
  });
});
