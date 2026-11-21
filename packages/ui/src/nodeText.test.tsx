import { expect, it } from 'vitest';
import { nodeText } from './nodeText';

it('reads a bigint child as its digits, as React renders it', () => {
  expect(nodeText(<>{10n} items</>)).toBe('10 items');
});

it('walks any iterable of children, not only an array', () => {
  expect(nodeText(new Set(['a', 'b']))).toBe('ab');
  expect(nodeText(<b>{['x', <i key="y">y</i>]}</b>)).toBe('xy');
});

it('reads nothing from booleans, null, and undefined', () => {
  expect(nodeText([true, false, null, undefined, 'z'])).toBe('z');
});
