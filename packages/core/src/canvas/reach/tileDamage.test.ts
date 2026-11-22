import { describe, expect, it } from 'vitest';
import { boxesMeet, createPlaneScheme, TilePyramid, type PlaneTileKey, type PlaneTileView } from '@weasel-js/tiles';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { defaultPaintBounds } from '../defaultDrawOne';
import { createSceneTileSources } from './tileDamage';

const fill = { fill: { paint: { kind: 'solid' as const, color: 'red' } } };

describe('a tiled scene layer\'s damage', () => {
  it('stales exactly the held tiles a moved node\'s old and new boxes meet, at every level', () => {
    const scene = createScene<typeof fill, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 10, y: 10, width: 20, height: 20 }, data: fill });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 600, y: 600, width: 20, height: 20 }, data: fill });
    const src = createSceneTileSources(scene, defaultPaintBounds as never)('main');
    expect(src.damage.since()).toEqual([]);
    expect(Array.from(src.bounds() as ArrayLike<number>)).toEqual([10, 10, 620, 620]);

    const scheme = createPlaneScheme(64);
    const pyramid = new TilePyramid<PlaneTileKey, PlaneTileView, object>({ scheme, bytesOf: () => 1, release: () => {}, floor: () => [] });
    const held: PlaneTileKey[] = [];
    for (const z of [-2, -1, 0, 1, 2]) for (const k of scheme.keysMeeting([0, 0, 1000, 1000], z)) {
      pyramid.cache.put(k, {}, 0, 0);
      held.push(k);
    }

    scene.setPose(a, { x: 300, y: 40, width: 20, height: 20 });
    const boxes = src.damage.since();
    expect(boxes).not.toBe('all');
    expect(boxes).toHaveLength(2);
    for (const box of boxes as Float64Array[]) pyramid.dirty(box);

    const meets = (k: PlaneTileKey, b: ArrayLike<number>) => {
      const pad = 1 / scheme.texelsPerUnit(k);
      return boxesMeet([b[0]! - pad, b[1]! - pad, b[2]! + pad, b[3]! + pad], scheme.boundsOf(k), 2);
    };
    for (const k of held) {
      const want = meets(k, [10, 10, 30, 30]) || meets(k, [300, 40, 320, 60]);
      expect(pyramid.cache.get(scheme.idOf(k))!.stale, scheme.idOf(k)).toBe(want);
    }
  });

});
