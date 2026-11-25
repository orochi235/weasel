/** Flip under a container whose `transform` shears its children's frame. */
import { describe, it, expect, vi } from 'vitest';
import { createScene, scenePoseFrame } from '@weasel-js/core/engine';
import { asNodeId, type RectPose, type Scene } from '@weasel-js/core';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { transformPoint, type Affine } from '@weasel-js/geom';
import { flipAction } from './action';

const G = asNodeId('g');
const A = asNodeId('a');

describe('flipAction under a sheared container', () => {
  it('hands the geometry seam a mirror whose line is the world mirror line', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
    scene.add({ id: G, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100, transform: [1, 0, 1, 1] } });
    scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, parent: G, pose: { x: 10, y: 10, width: 20, height: 10 } });
    const frame = scenePoseFrame(scene);
    const seen: Affine[] = [];
    const geometryProjection = { transform: vi.fn((_n: unknown, m: Affine) => { seen.push(m); return null; }) };
    (flipAction.invoker as ImmediateInvoker).run(
      { operands: { get: () => [A] }, scene, geometryProjection } as never,
      { axis: 'x', pivot: { x: 40, y: 0 } } as never,
    );
    const local = (x: number, y: number) => frame.local(A, { x, y, width: 0, height: 0, rotation: 0 }) as RectPose;
    for (const t of [0, 30, 80]) {
      const at = local(40, t);
      const [mx, my] = transformPoint(seen[0]!, at.x, at.y);
      expect(mx).toBeCloseTo(at.x, 9);
      expect(my).toBeCloseTo(at.y, 9);
    }
  });
});
