import { expect, it } from 'vitest';
import { insertedAt, movedTo, removedAt } from './rowIds';

const fresh = () => 'n';

it('shifts ids as an insert, a removal and a move shift the items', () => {
  expect(insertedAt(1)(['a', 'b'], fresh)).toEqual(['a', 'n', 'b']);
  expect(removedAt(0)(['a', 'b', 'c'], fresh)).toEqual(['b', 'c']);
  expect(movedTo(0, 2)(['a', 'b', 'c'], fresh)).toEqual(['b', 'c', 'a']);
  expect(movedTo(2, 0)(['a', 'b', 'c'], fresh)).toEqual(['c', 'a', 'b']);
});
