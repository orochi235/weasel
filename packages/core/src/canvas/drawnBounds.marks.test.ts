import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { drawnBoundsOf } from './drawnBounds';

const RED = { kind: 'solid', color: '#f00' } as const;
const POSE: RectPose = { x: 0, y: 0, width: 100, height: 100 };

function markWith(child: RectPose) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: asNodeId('m'), kind: 'mark', layer: 'main', pose: POSE,
    data: { shape: 'rect', stroke: { paint: RED, width: 10 } },
  } as never);
  scene.add({
    id: asNodeId('c'), kind: 'mark', layer: 'main', parent: asNodeId('m'),
    pose: child, data: { shape: 'rect' },
  } as never);
  return drawnBoundsOf(scene as never, asNodeId('m'), POSE);
}

describe('drawnBoundsOf — a mark that has children', () => {
  it('includes its own stroke around a child inside it', () => {
    expect(markWith({ x: 20, y: 20, width: 10, height: 10 })).toEqual({ x: -5, y: -5, width: 110, height: 110 });
  });

  it('reaches out to a child that sticks out of it', () => {
    expect(markWith({ x: 90, y: 0, width: 60, height: 100 })).toEqual({ x: -5, y: -5, width: 155, height: 110 });
  });
});
