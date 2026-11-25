/** A lone path-effect node, whose box derives from a source it is not centered on, flips about the box its
 *  chrome draws, whichever pivot names it. */
import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { RectPose } from '@weasel-js/core';
import { flipAction } from './action';

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

function flipped(pivot: 'union' | 'each'): RectPose {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const s = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const d = scene.add({
    kind: 'mark', layer: 'main', data: {}, pose: box(0, 0), dependsOn: [s],
    derivePose: (_n, deps) => {
      const p = deps[0]?.pose as RectPose | undefined;
      return p ? { ...p, x: p.x + 30 } : null;
    },
  });
  (flipAction.invoker as ImmediateInvoker).run({ operands: { get: () => [d] }, scene } as never, { axis: 'x', pivot } as never);
  return scene.get(s)!.pose as RectPose;
}

describe('flipping a node derived from one source', () => {
  it("mirrors the source about the derived node's own box under 'union', as under 'each'", () => {
    // The derived box spans x 30..40, so the source at 0..10 lands at 60..70.
    expect(flipped('union').x).toBeCloseTo(60, 9);
    expect(flipped('each').x).toBeCloseTo(60, 9);
  });
});
