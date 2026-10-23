import { describe, expect, it } from 'vitest';
import { INHERIT, type PaintedFill } from '@weasel-js/paint';
import { inheritedPaintIn } from './inheritedPaint';
import { createScene } from './scene';
import type { RectPose } from './types';

const RED: PaintedFill = { paint: { kind: 'solid', color: '#f00' } };
const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };

describe('inheritedPaintIn', () => {
  it('a child that inherits paints with its mark parent’s fill', () => {
    const scene = createScene<{ fill?: unknown }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const parent = scene.add({ kind: 'mark', layer: 'main', data: { fill: RED }, pose: POSE });
    const child = scene.add({ kind: 'mark', layer: 'main', parent, data: { fill: INHERIT }, pose: POSE });
    expect(inheritedPaintIn(scene, scene.get(child)!)?.fill).toBe(RED);
  });
});
