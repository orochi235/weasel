/** A resize snapping through the `snap` dep's session. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle, OngoingInvoker, ResizeAnchor } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import { sceneSession2d } from 'features/snap/sceneSession2d';
import type { SnapSource } from 'features/snap/types';
import type { PointSnapBehavior } from '../../gestures/types';
import { rotatePoint } from '../rotate/geometry';
import { drawnBoxes } from '../drawnBoxes';
import type { SnapDep } from '../snapDep';
import { resizeAction } from './action';

type Point = { x: number; y: number };
type Pose = Bounds & { rotation?: number };
type AnyScene = Scene<unknown, string, unknown>;

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const SE: ResizeAnchor = { x: 'min', y: 'min' };
const EAST: ResizeAnchor = { x: 'min', y: 'free' };

/** A ruler guide: the line `axis = at`, for the pointer, marked. */
const guide = (axis: 'x' | 'y', at: number): SnapSource => ({
  id: `guide-${axis}${at}`, roles: ['pointer'],
  *collect(q) {
    for (const p of q.probes) {
      yield axis === 'x'
        ? { probe: p.id, locus: { at: { x: at, y: p.at.y }, dirs: [{ x: 0, y: 1 }] }, mark: guideMark(axis, at) }
        : { probe: p.id, locus: { at: { x: p.at.x, y: at }, dirs: [{ x: 1, y: 0 }] }, mark: guideMark(axis, at) };
    }
  },
});

const guideMark = (axis: 'x' | 'y', at: number) => (axis === 'x'
  ? { kind: 'line' as const, from: { x: at, y: 0 }, to: { x: at, y: 1 } }
  : { kind: 'line' as const, from: { x: 0, y: at }, to: { x: 1, y: at } });

/** Grid lines every 10 on both axes, for the pointer. */
const grid10: SnapSource = {
  id: 'grid', tier: 'fallback', reachPx: Infinity, roles: ['pointer'],
  *collect(q) {
    for (const p of q.probes) {
      yield { probe: p.id, locus: { at: { x: Math.round(p.at.x / 10) * 10, y: p.at.y }, dirs: [{ x: 0, y: 1 }] } };
      yield { probe: p.id, locus: { at: { x: p.at.x, y: Math.round(p.at.y / 10) * 10 }, dirs: [{ x: 1, y: 0 }] } };
    }
  },
};

/** The left and right edges of every node the gesture does not move, for the box. */
const siblingEdges: SnapSource = {
  id: 'edges', roles: ['box'],
  *collect(q) {
    for (const id of q.scene!.roots) {
      if (q.exclude.includes(id)) continue;
      const b = q.drawnBox!(id)!;
      for (const x of [b.x, b.x + b.width]) {
        for (const p of q.probes) {
          yield { probe: p.id, locus: { at: { x, y: p.at.y }, dirs: [{ x: 0, y: 1 }] }, mark: { kind: 'line', from: { x, y: 0 }, to: { x, y: 1 } } };
        }
      }
    }
  },
};

function rig(sources: readonly SnapSource[], poses: readonly Pose[], extra: Record<string, unknown> = {}) {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
  const ids = poses.map((pose) => scene.add({ kind: 'leaf', layer: 'main', data: {}, pose }) as string);
  const store = createSnapOutcomeStore();
  const snap: SnapDep = {
    point: (p) => p,
    begin: (req) => sceneSession2d({ req, scene, boxes: drawnBoxes({ scene }), sources, view: () => VIEW, reachPx: 8, store }),
  };
  const deps = { scene, selection: { get: () => [ids[0]], set: () => {} } as unknown as SelectionApi, snap, ...extra };
  let from: Point = { x: 0, y: 0 };
  let anchor: ResizeAnchor = SE;
  const at = (p: Point, mods: Partial<typeof KEYS> = {}) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps,
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y }, affordance: { kind: 'handle', anchor } },
  }) as unknown as InvocationCtx;
  const press = (p: Point, a: ResizeAnchor = SE): OngoingHandle => {
    from = p;
    anchor = a;
    return (resizeAction.invoker as OngoingInvoker).start(at(p), undefined);
  };
  const preview = (h: OngoingHandle) => h.previewPose!(ids[0]) as Pose;
  const pose = () => scene.get(asNodeId(ids[0]) as NodeId)!.pose as Pose;
  return { scene, ids, store, at, press, preview, pose };
}

const near = (a: Bounds, b: Bounds) => {
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(a[k]).toBeCloseTo(b[k], 9);
};

const BOX: Pose = { x: 0, y: 0, width: 100, height: 50 };

describe('a resize snapping through the snap session', () => {
  it('lands the right edge on a guide within 5px, and leaves the left edge', () => {
    const r = rig([guide('x', 140)], [BOX]);
    const h = r.press({ x: 100, y: 25 }, EAST);
    h.onMove!(r.at({ x: 136, y: 25 }));
    h.onEnd!(r.at({ x: 136, y: 25 }), 'commit');
    near(r.pose(), { x: 0, y: 0, width: 140, height: 50 });
  });

  it('keeps the aspect under Shift and lands the corner where the diagonal meets a guide', () => {
    const r = rig([guide('x', 150)], [BOX]);
    const h = r.press({ x: 100, y: 50 });
    // The diagonal runs (2, 1); x = 150 meets it at (150, 75).
    h.onMove!(r.at({ x: 147, y: 70 }, { shift: true }));
    near(r.preview(h), { x: 0, y: 0, width: 150, height: 75 });
    h.onEnd!(r.at({ x: 147, y: 70 }, { shift: true }), 'commit');
  });

  it('rounds the dragged corner to a grid source', () => {
    const r = rig([grid10], [BOX]);
    const h = r.press({ x: 100, y: 50 });
    h.onMove!(r.at({ x: 123, y: 58 }));
    near(r.preview(h), { x: 0, y: 0, width: 120, height: 60 });
    h.onEnd!(r.at({ x: 123, y: 58 }), 'commit');
  });

  it('aligns a turned node\'s dragged corner to a sibling\'s edge', () => {
    // 100x40 turned a quarter turn about (50, 20): its local bottom-right
    // corner is at world (30, 70), and its top-left, which the handle pins, at (70, -30).
    const turned: Pose = { x: 0, y: 0, width: 100, height: 40, rotation: Math.PI / 2 };
    const r = rig([siblingEdges], [turned, { x: 25, y: 200, width: 10, height: 10 }]);
    const h = r.press({ x: 30, y: 70 });
    // The corner reaches (32, 75), 3 from the sibling's right edge at 35.
    h.onMove!(r.at({ x: 32, y: 75 }));
    const p = r.preview(h);
    const corner = (lx: number, ly: number) => rotatePoint(lx, ly, p.x + p.width / 2, p.y + p.height / 2, p.rotation!);
    const dragged = corner(p.x + p.width, p.y + p.height);
    const fixed = corner(p.x, p.y);
    expect(dragged.x).toBeCloseTo(35, 9);
    expect(dragged.y).toBeCloseTo(75, 9);
    expect(fixed.x).toBeCloseTo(70, 9);
    expect(fixed.y).toBeCloseTo(-30, 9);
    expect(r.store.get()).toHaveLength(1);
    h.onEnd!(r.at({ x: 32, y: 75 }), 'cancel');
  });

  it('never moves an edge handle along the other axis', () => {
    // The y guide is in reach of the pointer, but the east edge only moves on x,
    // so the y guide is never met and never marked.
    const r = rig([guide('x', 140), guide('y', 30)], [BOX]);
    const h = r.press({ x: 100, y: 25 }, EAST);
    h.onMove!(r.at({ x: 137, y: 28 }));
    near(r.preview(h), { x: 0, y: 0, width: 140, height: 50 });
    expect(r.store.get()).toEqual([guideMark('x', 140)]);
    h.onMove!(r.at({ x: 137, y: 28 }, { shift: true }));
    expect(r.preview(h).width).toBeCloseTo(140, 9);
    expect(r.store.get()).toEqual([guideMark('x', 140)]);
    h.onEnd!(r.at({ x: 137, y: 28 }), 'cancel');
  });

  it('grows a thin box with the cursor under Shift, on the axis the drag leads', () => {
    const r = rig([], [{ x: 0, y: 0, width: 1000, height: 10 }]);
    const h = r.press({ x: 1000, y: 10 });
    h.onMove!(r.at({ x: 1000, y: 110 }, { shift: true }));
    near(r.preview(h), { x: 0, y: 0, width: 11000, height: 110 });
    h.onEnd!(r.at({ x: 1000, y: 110 }), 'cancel');
  });

  it('suspends snapping under Ctrl and clears the marks however the drag ends', () => {
    const r = rig([siblingEdges], [BOX, { x: 140, y: 200, width: 10, height: 10 }]);
    const h = r.press({ x: 100, y: 25 }, EAST);
    h.onMove!(r.at({ x: 137, y: 25 }, { ctrl: true }));
    near(r.preview(h), { x: 0, y: 0, width: 137, height: 50 });
    expect(r.store.get()).toEqual([]);
    h.onMove!(r.at({ x: 137, y: 25 }));
    near(r.preview(h), { x: 0, y: 0, width: 140, height: 50 });
    expect(r.store.get()).not.toEqual([]);
    h.onEnd!(r.at({ x: 137, y: 25 }), 'cancel');
    expect(r.store.get()).toEqual([]);
    near(r.pose(), BOX);
  });

  it('runs a policy\'s point snap only while the session holds nothing', () => {
    const corner: PointSnapBehavior<Bounds> = { onMove: () => ({ frame: 'dragged-corner', worldX: 200, worldY: 100 }) };
    const policy = { constraints: [], pointSnap: [corner], expandIds: (ids: string[]) => ids };
    const r = rig([guide('x', 140)], [BOX], { resizePolicy: policy });
    const h = r.press({ x: 100, y: 50 });
    h.onMove!(r.at({ x: 137, y: 60 }));
    near(r.preview(h), { x: 0, y: 0, width: 140, height: 60 });
    h.onMove!(r.at({ x: 170, y: 60 }));
    near(r.preview(h), { x: 0, y: 0, width: 200, height: 100 });
    h.onEnd!(r.at({ x: 170, y: 60 }), 'cancel');
  });
});
