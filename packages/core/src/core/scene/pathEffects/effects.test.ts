import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { createPathEffectDerivations } from './derive';
import { effectParts, type PathEffect } from './effects';
import type { EffectSource } from './source';

const source = (x: number): EffectSource => ({ world: rectPath(x, 0, 10, 10) }) as EffectSource;

describe('a path effect of a kind this build does not know', () => {
  // A document saved before `blend` became `tween`, or by a later build with a kind added.
  const unknown = { kind: 'blend', steps: 2 } as unknown as PathEffect;

  it('paints nothing', () => {
    expect(effectParts(unknown, [source(0), source(50)])).toBeNull();
  });

  it('derives no path or pose rather than throwing', () => {
    const fx = createPathEffectDerivations((dep) => source((dep.pose as { x: number }).x));
    const node = { data: { pathEffect: unknown } };
    const deps = [0, 50].map((x) => ({ node: {}, pose: { x }, path: null, inherited: undefined }) as never);
    expect(fx.derivePath(node, deps)).toBeNull();
    expect(fx.derivePose(node, deps)).toBeNull();
  });
});
