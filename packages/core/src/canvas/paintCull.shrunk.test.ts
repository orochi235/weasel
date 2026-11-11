/**
 * Counterexamples the cull's property test found, kept as plain examples.
 */
import { describe, expect, it } from 'vitest';
import { cullDrawCommands } from '@weasel-js/renderer';
import { viewToMat3 } from '@weasel-js/geom';
import { defaultDrawOne, defaultPaintBounds } from './defaultDrawOne';
import { paintMissesView } from './paintCull';
import { wrapWithPoseRotation } from './poseRotation';

describe('a { px } stroke on a pose whose transform squashes it', () => {
  it('is not culled while the renderer would draw it in view', () => {
    const pose = { x: 0, y: 0, width: 1, height: 1, transform: [0, -0.6269513529248637, -0.07975100423141157, 0] };
    const node = {
      id: 'n', kind: 'mark', layer: 'main', pose,
      data: { shape: 'rect', fill: { paint: { kind: 'solid', color: '#000' } }, stroke: { paint: { kind: 'solid', color: '#000' }, width: { px: 0.5 } } },
    } as never;
    const view = { x: 0, y: 0, scale: { x: 0.1, y: 0.1 } };
    const rect = { x: -11.113489558674395, y: 0, width: 10, height: 10 };
    const drawn = cullDrawCommands(wrapWithPoseRotation(defaultDrawOne(node, pose, view), pose), viewToMat3(view), rect, 1);
    expect(drawn).not.toEqual([]);
    expect(paintMissesView(defaultPaintBounds, view, rect)(node, pose)).toBe(false);
  });
});
