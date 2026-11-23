import { describe, expect, it } from 'vitest';
import { edgeBetween, rectShape } from './avoidFixture';
import { createAvoidRouter } from './router';
import type { AvoidInput } from './types';

const a = rectShape('a', 0, 0);
const b = rectShape('b', 400, 0);
const input = (by: number): AvoidInput => {
  const moved = rectShape('b', 400, by);
  return { obstacles: [a, moved], edges: [{ ...edgeBetween('ab', a, moved, 'e', 'w'), route: [] }] };
};

describe('a preview over its budget', () => {
  it('keeps a connector it does not reach at the route an earlier frame of the same drag gave it', () => {
    const router = createAvoidRouter();
    router.seed({ obstacles: [a, b], edges: input(0).edges });
    router.beginPreview();
    const first = router.update(input(200), { preview: true }).get('ab');
    expect(router.update(input(210), { preview: true, budgetMs: -1 }).get('ab')).toEqual(first);
  });

  it('leaves out a route a drag before this one previewed', () => {
    const router = createAvoidRouter();
    router.seed({ obstacles: [a, b], edges: input(0).edges });
    router.beginPreview();
    router.update(input(200), { preview: true });
    // That drag was cancelled: nothing committed. The next one runs out of time at once.
    router.beginPreview();
    expect(router.update(input(-200), { preview: true, budgetMs: -1 }).has('ab')).toBe(false);
  });
});

describe('a preview before anything is committed', () => {
  it('routes every connector around the obstacles it is given', () => {
    const wall = rectShape('wall', 200, -100, 60, 260);
    const router = createAvoidRouter();
    const routes = router.update({ obstacles: [a, b, wall], edges: [edgeBetween('ab', a, b, 'e', 'w')] }, { preview: true });
    expect(routes.get('ab')!.length).toBeGreaterThan(0);
  });
});
