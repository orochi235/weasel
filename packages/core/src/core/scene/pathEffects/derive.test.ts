import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { bumpNodeMemoGeneration } from '../nodeMemo';
import { createPathEffectDerivations } from './derive';
import type { PathEffect } from './effects';
import type { EffectSource } from './source';

describe('createPathEffectDerivations', () => {
  it('derives again once the node-memo generation moves, as a painter change moves it', () => {
    let shift = 0;
    const fx = createPathEffectDerivations((dep) =>
      ({ world: rectPath((dep.pose as { x: number }).x + shift, 0, 10, 10), fill: null, stroke: null }) as EffectSource);
    const node = { data: { pathEffect: { kind: 'tween', steps: 1 } as PathEffect } };
    const deps = [0, 50].map((x) => ({ node: {}, pose: { x }, path: null, inherited: undefined }) as never);
    expect(fx.derivePose(node, deps)!.x).toBe(25);
    shift = 100;
    bumpNodeMemoGeneration();
    expect(fx.derivePose(node, deps)!.x).toBe(125);
  });
});
