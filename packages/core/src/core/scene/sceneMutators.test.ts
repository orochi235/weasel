import { describe, expect, it } from 'vitest';
import { POSE, makeScene } from './testing/makeScene';
import { sceneMutators } from './sceneMutators';
import type { NodeId } from './types';

describe('sceneMutators.setChildOrder', () => {
  it('refuses an id that is not a child of the parent, leaving every container as it was', () => {
    const s = makeScene();
    const group = (): NodeId => s.add({ kind: 'group', layer: 'structures', pose: POSE, data: { label: 'g' } });
    const mark = (parent: NodeId): NodeId =>
      s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'm' }, parent });
    const p = group();
    const q = group();
    const c1 = mark(p);
    const c2 = mark(p);
    const y = mark(q);
    const x = mark(q);
    const m = sceneMutators(s);

    expect(() => m.setChildOrder(p, [c2, x])).toThrow(/not a child/);
    expect(() => m.setChildOrder(p, [c2, c2])).toThrow(/more than once/);
    expect(s.childrenOf(p)).toEqual([c1, c2]);
    expect(s.childrenOf(q)).toEqual([y, x]);

    m.setChildOrder(p, [c2, c1]);
    expect(s.childrenOf(p)).toEqual([c2, c1]);
  });
});
