import { describe, expect, it } from 'vitest';
import { edgeBetween, rectShape } from './avoidFixture';
import { createAvoidRouter } from './router';
import type { AvoidInput, AvoidObstacle } from './types';

const a = rectShape('a', 0, 0);
const b = rectShape('b', 400, 0);
/** A free-standing label, as a split connector's is, 8 units above the route along y = 30 once moved. */
const label = (y: number): AvoidObstacle => ({ id: 'L', kind: 'label', edge: 'split', box: { x: 200, y, width: 40, height: 12 } });
const input = (y: number): AvoidInput => ({ obstacles: [a, b, label(y)], edges: [{ ...edgeBetween('ab', a, b, 'e', 'w'), route: [] }] });
const OPTS = { clearance: 4, labelClearance: 12 };

describe('a label moved near a route, within its own clearance but not the shapes’', () => {
  it('reroutes the connector on commit', () => {
    const router = createAvoidRouter(OPTS);
    router.seed(input(-400));
    expect(router.update(input(10)).has('ab')).toBe(true);
  });

  it('reroutes the connector in a drag frame', () => {
    const router = createAvoidRouter(OPTS);
    router.seed(input(-400));
    expect(router.update(input(10), { preview: true }).has('ab')).toBe(true);
  });
});
