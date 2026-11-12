/**
 * A rotate under a scene's quantize rule previews the pose the rule stores,
 * so the release lands where the preview showed.
 */
import { describe, expect, it } from 'vitest';
import type { OutputGrid } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { OUTPUT_GRID_KEY } from 'core/scene/outputGrid';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { QuantizeRule } from 'core/scene/useSceneOptions';
import { rotateAction } from './action';

const ID = asNodeId('n');
const GRID: OutputGrid = { pitch: 0.4, origin: { x: 0, y: 0 } };
const step = (v: number, pitch: number) => Math.round(v / pitch) * pitch;
const RULE: QuantizeRule<object, RectPose> = {
  stored: ({ pose }, grid) => ({ pose: { ...pose, x: step(pose.x, grid.pitch), y: step(pose.y, grid.pitch) } }),
};

describe('a rotate under a quantize rule', () => {
  it('commits the pose it previewed', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], quantize: RULE, doc: { [OUTPUT_GRID_KEY]: GRID } });
    const other = asNodeId('m');
    scene.add({ id: ID, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 4, height: 2, rotation: 0 } });
    scene.add({ id: other, kind: 'mark', layer: 'main', data: {}, pose: { x: 8, y: 0, width: 4, height: 2, rotation: 0 } });
    // The two turn about their union's center, so each box's corner moves off the grid.
    const pivot = { x: 6, y: 1 };
    const ctxAt = (angle: number) => ({
      world: { x: pivot.x + 10 * Math.cos(angle), y: pivot.y + 10 * Math.sin(angle) },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => [ID, other] as NodeId[] }, scene: scene as unknown as Scene<unknown, string, unknown> },
    }) as unknown as InvocationCtx;
    const invoker = rotateAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctxAt(0), { behaviors: [] });
    handle.onMove!(ctxAt(0.37));
    const preview = scene.overrides.read(ID)?.pose as RectPose;
    handle.onEnd!(ctxAt(0.37), 'commit');
    expect(preview).toBeDefined();
    expect(scene.get(ID)!.pose).toEqual(preview);
  });
});
