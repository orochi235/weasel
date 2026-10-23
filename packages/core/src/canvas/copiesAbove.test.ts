import { describe, expect, it } from 'vitest';
import { multiply, translate } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { copiesAbove } from './copiesAbove';

const BOX: RectPose = { x: 0, y: 0, width: 0, height: 0 };

describe('copiesAbove', () => {
  it('composes the copies of every ancestor, outer around inner, without the identity', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const outer = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {}, copiesFromPose: () => [translate(100, 0)] });
    const plain = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {}, parent: outer });
    const inner = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {}, parent: plain, copiesFromPose: () => [translate(0, 10)] });
    const leaf = scene.add({ kind: 'mark', layer: 'main', pose: BOX, data: {}, parent: inner });
    expect(copiesAbove(scene, leaf, (n) => n.pose)).toEqual([
      translate(0, 10), translate(100, 0), multiply(translate(100, 0), translate(0, 10)),
    ]);
  });

  it('is empty when nothing above draws copies', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', pose: BOX, data: {} });
    const leaf = scene.add({ kind: 'mark', layer: 'main', pose: BOX, data: {}, parent: g });
    expect(copiesAbove(scene, leaf, (n) => n.pose)).toEqual([]);
  });
});
