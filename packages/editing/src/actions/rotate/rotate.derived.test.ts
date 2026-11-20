/** A lone path-effect node, whose box derives from a single source it is not centered on, turns about the box
 *  its chrome draws. */
import { describe, expect, it } from 'vitest';
import { rotateAction } from './action';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { RectPose } from '@weasel-js/core';

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

describe('rotating a node derived from one source', () => {
  it("orbits the source about the derived node's own center", () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const s = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
    const d = scene.add({
      kind: 'mark', layer: 'main', data: {}, pose: box(0, 0), dependsOn: [s],
      derivePose: (_n, deps) => {
        const p = deps[0]?.pose as RectPose | undefined;
        return p ? { ...p, x: p.x + 30 } : null;
      },
    });
    const at = (x: number, y: number) => ({
      world: { x, y }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { operands: { get: () => [d] }, scene },
    }) as unknown as InvocationCtx;
    const invoker = rotateAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    // The derived box is centered on (35, 5): press due east of it, release due south, a quarter turn.
    const handle = invoker.start(at(135, 5), undefined);
    handle.onMove!(at(35, 105));
    handle.onEnd!(at(35, 105), 'commit');
    const p = scene.get(s)!.pose as RectPose;
    expect(p.x + p.width / 2).toBeCloseTo(35, 9);
    expect(p.y + p.height / 2).toBeCloseTo(-25, 9);
  });
});
