/**
 * A resize under a scene's quantize rule previews the pose the rule stores,
 * holding the side the drag holds, and commits that same pose.
 */
import { describe, expect, it } from 'vitest';
import { alignToGrid, snapToPitch, type OutputGrid } from '@weasel-js/geom';
import type { InvocationCtx, ResizeAnchor } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { OUTPUT_GRID_KEY, quantizeSize } from 'core/scene/outputGrid';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { QuantizeRule } from 'core/scene/useSceneOptions';
import { resizeAction } from './action';

type Data = { kind: 'box' };
type S = Scene<Data, 'main', RectPose>;
const GRID: OutputGrid = { pitch: 0.4, origin: { x: 0, y: 0 } };
const dots = (v: number) => v / GRID.pitch;
const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
const BOX = asNodeId('box');
const RULE: QuantizeRule<Data, RectPose> = {
  stored: ({ pose }, grid, anchor) => ({
    pose: quantizeSize(pose, snapToPitch(pose.width, grid.pitch), snapToPitch(pose.height, grid.pitch), anchor),
  }),
  drawn: ({ pose }, grid) => alignToGrid(pose, grid),
};

function makeScene(): S {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }], quantize: RULE, doc: { [OUTPUT_GRID_KEY]: GRID } });
  scene.add({ id: BOX, kind: 'mark', layer: 'main', data: { kind: 'box' }, pose: { x: 1.13, y: 2.07, width: 10.1, height: 0.1 } });
  return scene;
}

describe('a resize under a quantize rule', () => {
  function drag(scene: S, anchor: ResizeAnchor, from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = (at: { x: number; y: number }) => ({
      world: at,
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => [BOX] }, scene },
      drag: {
        start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
        affordance: { kind: 'handle:corner', targetIds: [BOX], anchor },
      },
    }) as unknown as InvocationCtx;
    const invoker = resizeAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(ctx(from), undefined);
    handle.onMove!(ctx(to));
    const preview = scene.overrides.read(BOX as NodeId)?.pose as RectPose;
    handle.onEnd!(ctx(to), 'commit');
    return preview;
  }

  for (const [name, anchor, corner] of [
    ['bottom-right', { x: 'min', y: 'min' }, (p: RectPose) => ({ x: p.x + p.width, y: p.y + p.height })],
    ['top-left', { x: 'max', y: 'max' }, (p: RectPose) => ({ x: p.x, y: p.y })],
    ['top-right', { x: 'min', y: 'max' }, (p: RectPose) => ({ x: p.x + p.width, y: p.y })],
    ['bottom-left', { x: 'max', y: 'min' }, (p: RectPose) => ({ x: p.x, y: p.y + p.height })],
  ] as const) {
    it(`from the ${name} handle snaps with the opposite side held, and commits what it previewed`, () => {
      const scene = makeScene();
      const start = scene.get(BOX)!.pose;
      const held = { x: anchor.x === 'max' ? start.x + start.width : start.x, y: anchor.y === 'max' ? start.y + start.height : start.y };
      const from = corner(start);
      const preview = drag(scene, anchor, from, { x: from.x + 1.13, y: from.y + 0.91 });
      const end = scene.get(BOX)!.pose;
      expect(preview).toBeDefined();
      expect(end).toEqual(preview);
      expect(whole(dots(end.width))).toBe(true);
      expect(whole(dots(end.height))).toBe(true);
      expect(anchor.x === 'max' ? end.x + end.width : end.x).toBeCloseTo(held.x, 9);
      expect(anchor.y === 'max' ? end.y + end.height : end.y).toBeCloseTo(held.y, 9);
    });
  }
});

