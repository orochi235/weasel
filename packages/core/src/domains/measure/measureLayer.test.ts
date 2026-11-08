import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import type { DrawCommand } from '@weasel-js/renderer';
import { createMeasurements } from './measurements';
import { measureNode } from './measurement';
import { measurementsLayer } from './measureLayer';

type AnyScene = Scene<unknown, string, unknown>;

/** The centers of the handle squares `cmds` draws, in screen px. */
function handleCenters(cmds: readonly DrawCommand[]): { x: number; y: number }[] {
  return cmds.flatMap((c) => {
    if (c.kind !== 'path' || !c.fill) return [];
    const r = c.path as { kind: string; x: number; y: number; width: number; height: number };
    return r.kind === 'rect' ? [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] : [];
  });
}

describe('measurementsLayer', () => {
  it("draws the picked measurement's handles where a gesture's override shows its ends", () => {
    const scene = createScene<object, 'notes', RectPose>({ systemLayers: [{ id: 'notes', annotation: true }] });
    const any = scene as unknown as AnyScene;
    const id = any.mintId();
    any.add(measureNode(id, 'notes', { x: 0, y: 0 }, { x: 10, y: 0 }) as never);
    const ms = createMeasurements({ layer: 'notes' });
    ms.picked.set(id as NodeId);
    any.overrides.set(id as NodeId, {
      data: () => ({ measure: { start: { x: 0, y: 0 }, end: { x: 40, y: 30 } } }),
    });
    const layer = measurementsLayer(any, ms);
    const cmds = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 }) as DrawCommand[];
    const centers = handleCenters(cmds);
    expect(centers).toHaveLength(2);
    expect(centers[1]!.x).toBeCloseTo(40, 3);
    expect(centers[1]!.y).toBeCloseTo(30, 3);
  });
});
