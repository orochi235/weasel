import { expect, it } from 'vitest';
import { sameStored } from './json';

it('reads two values a JSON store keeps alike as the same, and a bigint as the digits it is stored as', () => {
  expect(sameStored({ a: [1, 2], b: 'x' }, { a: [1, 2], b: 'x' })).toBe(true);
  expect(sameStored({ n: 12n }, { n: 12n })).toBe(true);
  expect(sameStored({ n: 12n }, { n: 13n })).toBe(false);
  expect(sameStored(undefined, null)).toBe(false);
});

it('answers false for a value JSON cannot write, rather than throwing', () => {
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  const again: Record<string, unknown> = {};
  again.self = again;
  expect(sameStored(loop, again)).toBe(false);
  expect(sameStored(loop, loop)).toBe(true);
  expect(sameStored(undefined, () => {})).toBe(false);
});
