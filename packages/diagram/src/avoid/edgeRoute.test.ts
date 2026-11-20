import { describe, expect, it, vi } from 'vitest';

let calls = 0;
vi.mock('./search', async (original) => {
  const mod = await original<typeof import('./search')>();
  // A leg with no path in any window that is not sealed either: every search answers null.
  return {
    ...mod,
    searchLeg: () => {
      if (++calls > 5000) throw new Error('the window kept growing');
      return null;
    },
  };
});

import { edgeBetween, rectShape, routeContext } from './avoidFixture';
import { routeEdge as edgeRoute } from './edgeRoute';

describe('routeEdge', () => {
  it.each([
    ['NaN', { x: Number.NaN, y: 0, width: 100, height: 100 }],
    ['infinite', { x: -Infinity, y: -Infinity, width: Infinity, height: Infinity }],
  ])('gives up on a leg with no path when the limit is %s', (_name, limit) => {
    calls = 0;
    const a = rectShape('a', 0, 0);
    const b = rectShape('b', 400, 0);
    const ctx = { ...routeContext([a, b]), limit };
    expect(edgeRoute(edgeBetween('ab', a, b, 'e', 'w'), ctx)).toBeNull();
  });
});
