/** What `renderDebugSnapshot` asks of the headless render, without a GPU. */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import type { NodePaintCtx } from './nodeShapeTypes';
import { createDebugSink } from '../debug/createDebugSink';
import { debugSnapshotArgs } from './renderDebugSnapshot';
import { planPixelRender } from './renderSceneToPixels';

describe('debugSnapshotArgs', () => {
  it('measures { px } lengths in CSS pixels at a pixel ratio above 1, as the screen did', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 10, height: 10 }, data: null });
    const seen: NodePaintCtx[] = [];
    const plan = planPixelRender(debugSnapshotArgs({
      scene,
      drawOne: (_n, _p, _v, ctx) => { seen.push(ctx ?? {}); return []; },
      debug: createDebugSink({}).snapshot(),
      config: {},
      view: { x: 5, y: 5, scale: { x: 2, y: 2 } },
      size: { width: 40, height: 30 },
      pixelRatio: 2,
    }));
    expect([plan.width, plan.height]).toEqual([80, 60]);
    // A { px } length resolves against `scale`: 2 CSS px per world unit, as on the canvas, painted at density 2.
    expect(seen[0]).toMatchObject({ scale: 2, pixelScale: 4 });
  });

  it('refuses a pixel ratio that is not a positive number', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const args = (pixelRatio: number) => ({
      scene, sourceRect: { x: 0, y: 0, width: 4, height: 4 }, scale: { x: 1, y: 1 }, pixelRatio,
    });
    expect(() => planPixelRender(args(0))).toThrow(RangeError);
    expect(() => planPixelRender(args(Number.NaN))).toThrow(RangeError);
  });
});
