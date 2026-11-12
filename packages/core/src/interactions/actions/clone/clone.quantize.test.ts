/**
 * An Alt-drag clone under a scene's quantize rule previews the copy where the
 * rule will store it, so the release lands where the ghost showed.
 */
import { describe, expect, it } from 'vitest';
import { alignToGrid, snapToPitch, type OutputGrid } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { OUTPUT_GRID_KEY } from 'core/scene/outputGrid';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import type { QuantizeRule } from 'core/scene/useSceneOptions';
import { cloneAction } from './action';

type Data = { kind: 'box' };
type S = Scene<Data, 'main', RectPose>;
const GRID: OutputGrid = { pitch: 0.4, origin: { x: 0, y: 0 } };
const BOX = asNodeId('box');
const RULE: QuantizeRule<Data, RectPose> = {
  stored: ({ pose }, grid) => ({ pose: { ...pose, x: snapToPitch(pose.x, grid.pitch), y: snapToPitch(pose.y, grid.pitch) } }),
  drawn: ({ pose }, grid) => alignToGrid(pose, grid),
};

describe('a clone under a quantize rule', () => {
  it('previews the copy at the pose the rule commits', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }], quantize: RULE, doc: { [OUTPUT_GRID_KEY]: GRID } });
    scene.add({ id: BOX, kind: 'mark', layer: 'main', data: { kind: 'box' }, pose: { x: 0.8, y: 1.2, width: 4, height: 2 } });
    let selected: string[] = [BOX];
    const ctx = (dx: number, dy: number) => ({
      world: { x: dx, y: dy },
      screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => selected, set: (ids: string[]) => { selected = ids; } }, scene },
      drag: { start: { x: 0, y: 0 }, current: { x: dx, y: dy }, delta: { x: dx, y: dy } },
    }) as unknown as InvocationCtx;
    const invoker = cloneAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctx(0, 0), undefined);
    handle.onMove!(ctx(1.13, 0.91));
    const preview = handle.previewPose!(BOX) as RectPose;
    handle.onEnd!(ctx(1.13, 0.91), 'commit');
    const copy = [...scene.nodes.keys()].find((id) => id !== BOX)!;
    expect(scene.get(copy)!.pose).toEqual(preview);
  });
});
