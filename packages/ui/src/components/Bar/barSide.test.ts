import { expect, test } from 'vitest';
import { sideOf } from './barSide';

test.each([
  [{ x: 0, y: -1 }, 'top'],
  [{ x: 0, y: 1 }, 'bottom'],
  [{ x: 1, y: 0 }, 'right'],
  [{ x: -1, y: 0 }, 'left'],
  [{ x: -0.6, y: -0.8 }, 'top'],
  [{ x: 0.7071, y: 0.7071 }, 'bottom'],
] as const)('outward %o opens %s', (v, side) => expect(sideOf(v)).toBe(side));
