import { describe, expect, it } from 'vitest';
import {
  asNodeId, createScene, createSnapOutcomeStore, pathSnapSource, rotationSnapSource,
  type InvocationCtx, type OngoingInvoker, type RectPose, type SceneRegistry, type SnapDep,
} from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';
import { rectPath } from '@weasel-js/geom';
import { createSymmetry } from './controller';
import { symmetryRegistry } from './group';
import type { SymmetryHandlePress } from './guide';
import { handleDragAction } from './handleDrag';
import { VERTICAL_AXIS } from './kinds';

type Point = { x: number; y: number };
type Mods = Partial<typeof KEYS>;

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };
const DEG = Math.PI / 180;
const CENTER = { x: 100, y: 0 };

function rig() {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: symmetryRegistry as SceneRegistry<RectPose>,
  });
  const sym = createSymmetry(scene as never);
  const group = sym.create({ center: CENTER, symmetry: { kind: 'mirror', angle: VERTICAL_AXIS } });
  // A 10 x 10 square whose corners are path anchors, the nearest at 200,50.
  scene.add({
    kind: 'leaf', layer: 'main', id: asNodeId('sq'),
    pose: { x: 200, y: 50, width: 10, height: 10 }, data: { path: rectPath(0, 0, 10, 10) },
  });
  const store = createSnapOutcomeStore();
  const snap: SnapDep = {
    begin: ({ plane: _plane, ...req }) => createSnapSession2dForTests({
      scene: scene as never, view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      sources: [pathSnapSource(), rotationSnapSource()], store, ...req,
    }),
  };
  const ctx = (handle: SymmetryHandlePress['handle'], start: Point, p: Point, mods: Mods = {}) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps: { snap },
    drag: {
      start, current: p, delta: { x: p.x - start.x, y: p.y - start.y },
      affordance: { payload: { handle, group } },
    },
  }) as unknown as InvocationCtx;
  /** Drag `handle`, pressed at `start`, to `to`; `seen` is what the readout
   *  held before the release. */
  const drag = (handle: SymmetryHandlePress['handle'], start: Point, to: Point, mods: Mods = {}) => {
    const h = (handleDragAction(sym).invoker as OngoingInvoker).start(ctx(handle, start, start), undefined);
    h.onMove!(ctx(handle, start, to, mods));
    const seen = store.get();
    h.onEnd!(ctx(handle, start, to, mods), 'commit');
    return { ...sym.read(group)!, seen };
  };
  /** Drag the center handle, pressed on the center, to `to`. */
  const dragCenter = (to: Point, mods: Mods = {}) => drag('center', CENTER, to, mods).center;
  /** Drag the axis knob, pressed 50 below the center, to `deg` degrees about it. */
  const turnKnob = (deg: number, mods: Mods = {}) => drag('angle', { x: CENTER.x, y: CENTER.y + 50 }, {
    x: CENTER.x + 50 * Math.cos(deg * DEG), y: CENTER.y + 50 * Math.sin(deg * DEG),
  }, mods);
  return { dragCenter, turnKnob };
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

describe('the symmetry axis drag', () => {
  it('holds the axis to 15° steps under Shift, and draws a readout', () => {
    const out = rig().turnKnob(52, { shift: true });
    expect(out.spec.angle).toBeCloseTo(45 * DEG, 9);
    expect(out.seen).toContainEqual(expect.objectContaining({ kind: 'point', label: '45°' }));
  });

  it('meets a quarter turn within reach, and turns freely past it', () => {
    expect(rig().turnKnob(92).spec.angle).toBeCloseTo(90 * DEG, 9);
    expect(rig().turnKnob(110).spec.angle).toBeCloseTo(110 * DEG, 9);
  });

  it('leaves the axis on the pointer while Ctrl suspends snapping', () => {
    expect(rig().turnKnob(92, { ctrl: true }).spec.angle).toBeCloseTo(92 * DEG, 9);
  });
});
