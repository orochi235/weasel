/**
 * `drawnBoxes` measures what the document holds: a command such as Align acts
 * on it, so a stroke an override is showing mid-gesture does not move the box.
 */
import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { drawnBoxes } from './drawnBoxes';

const A = asNodeId('a');
const POSE: RectPose = { x: 0, y: 0, width: 20, height: 20 };

describe('drawnBoxes', () => {
  it('measures the stored stroke, not one a data override shows', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{
        id: A, kind: 'mark', layer: 'main', pose: POSE,
        data: { path: rectPath(0, 0, 20, 20), stroke: { paint: { color: '#000' }, width: 2 } },
      }],
    });
    const boxes = () => drawnBoxes({ scene } as never);
    const before = boxes().framed(A, POSE);
    scene.overrides.set(A, { data: (d) => ({ ...(d as object), stroke: { paint: { color: '#000' }, width: 40 } }) });
    expect(boxes().framed(A, POSE)).toEqual(before);
  });
});
