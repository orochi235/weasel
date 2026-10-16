import { expect, it } from 'vitest';
import { inTriangle } from './triangle';

it('tells inside from outside, edges counting as inside', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: -10 }, c = { x: 10, y: 10 };
  expect(inTriangle({ x: 5, y: 0 }, a, b, c)).toBe(true);
  expect(inTriangle({ x: 5, y: 5 }, a, b, c)).toBe(true);
  expect(inTriangle({ x: 5, y: 8 }, a, b, c)).toBe(false);
  expect(inTriangle({ x: -1, y: 0 }, a, b, c)).toBe(false);
});
