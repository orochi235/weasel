import { describe, expect, it } from 'vitest';
import {
  asNodeId, createScene, pathSnapSource,
  type InvocationCtx, type OngoingInvoker, type RectPose, type SceneRegistry, type SnapDep,
} from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';
import { rectPath } from '@weasel-js/geom';
import { createSymmetry } from './controller';
import { symmetryRegistry } from './group';
import { handleDragAction } from './handleDrag';
import { VERTICAL_AXIS } from './kinds';

type Point = { x: number; y: number };

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

function rig() {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: symmetryRegistry as SceneRegistry<RectPose>,
  });
  const sym = createSymmetry(scene as never);
  const group = sym.create({ center: { x: 100, y: 0 }, symmetry: { kind: 'mirror', angle: VERTICAL_AXIS } });
  // A 10 x 10 square whose corners are path anchors, the nearest at 200,50.
  scene.add({
    kind: 'leaf', layer: 'main', id: asNodeId('sq'),
    pose: { x: 200, y: 50, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) },
  });
  const snap: SnapDep = {
    begin: (req) => createSnapSession2dForTests({
      scene: scene as never, view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      sources: [pathSnapSource()], gesture: req.gesture, press: req.press,
    }),
  };
  const at = (p: Point, mods: Partial<typeof KEYS> = {}) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps: { snap },
    drag: { start: { x: 100, y: 0 }, current: p, delta: { x: p.x - 100, y: p.y }, affordance: { payload: { handle: 'center', group } } },
  }) as unknown as InvocationCtx;
  /** Drag the center handle, pressed on the center, to `to`. */
  const dragCenter = (to: Point, mods: Partial<typeof KEYS> = {}) => {
    const h = (handleDragAction(sym).invoker as OngoingInvoker).start(at({ x: 100, y: 0 }), undefined);
    h.onMove!(at(to, mods));
    h.onEnd!(at(to, mods), 'commit');
    return sym.read(group)!.center;
  };
  return { dragCenter };
}

describe('the symmetry center drag', () => {
  it('snaps the center to a path anchor', () => {
    const c = rig().dragCenter({ x: 197, y: 52 });
    expect(c.x).toBeCloseTo(200, 9);
    expect(c.y).toBeCloseTo(50, 9);
  });

  it('leaves the center where the pointer puts it while Ctrl suspends snapping', () => {
    expect(rig().dragCenter({ x: 197, y: 52 }, { ctrl: true })).toEqual({ x: 197, y: 52 });
  });
});
