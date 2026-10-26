/** A move snapping through the `snap` dep's session. */
import { heldPose } from '../testUtils';
import { describe, expect, it } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { pathFromD } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { SnapTarget } from 'core/adapters/types';
import { createSnapOutcomeStore } from 'domains/snap/outcomeStore';
import { sceneSession2d } from 'domains/snap/sceneSession2d';
import type { SnapSource } from 'domains/snap/types';
import { ownGeometryAt, pathSnapSource } from 'domains/paths/pathSnap/pathSnapSource';
import { drawnBoxes } from '../drawnBoxes';
import type { SnapBegin, SnapDep } from '../snapDep';
import type { GroupTransform, MoveBehavior } from '../../gestures/types';
import { snapToContainer } from './behaviors/snapToContainer';
import { moveAction } from './action';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Grid lines every 10 on both axes, for the pose origin. */
const grid10: SnapSource = {
  id: 'grid', tier: 'fallback', reachPx: Infinity, roles: ['origin'],
  *collect(q) {
    for (const p of q.probes) {
      yield { probe: p.id, locus: { at: { x: Math.round(p.at.x / 10) * 10, y: p.at.y }, dirs: [{ x: 0, y: 1 }] } };
      yield { probe: p.id, locus: { at: { x: p.at.x, y: Math.round(p.at.y / 10) * 10 }, dirs: [{ x: 1, y: 0 }] } };
    }
  },
};

/** A vertical line at `x` for the subject's box edges and center, marked. */
const alignX = (x: number): SnapSource => ({
  id: 'align', roles: ['box'],
  *collect(q) {
    for (const p of q.probes) {
      yield {
        probe: p.id,
        locus: { at: { x, y: p.at.y }, dirs: [{ x: 0, y: 1 }] },
        mark: { kind: 'line', from: { x, y: 0 }, to: { x, y: 100 } },
      };
    }
  },
});

function rig(sources: readonly SnapSource[], build: (scene: AnyScene) => string[]) {
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
  const ids = build(scene);
  const store = createSnapOutcomeStore();
  const begun: SnapBegin[] = [];
  const snap: SnapDep = {
    begin: (req) => {
      begun.push(req);
      return sceneSession2d({
        req, scene, boxes: drawnBoxes({ scene }), sources, view: () => VIEW, reachPx: 8, store,
        geometryAt: (press, own) => ownGeometryAt(scene, press, own, VIEW.scale),
      });
    },
  };
  const deps = { scene, selection: { get: () => [ids[0]], set: () => {} } as unknown as SelectionApi, snap };
  let from: Point = { x: 0, y: 0 };
  const at = (p: Point, mods: Partial<typeof KEYS> = {}) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps,
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y } },
  }) as unknown as InvocationCtx;
  const press = (p: Point, opts: BindingOpts = {}): OngoingHandle => {
    from = p;
    return (moveAction.invoker as OngoingInvoker).start(at(p), opts);
  };
  const pose = (id = ids[0]) => scene.get(asNodeId(id))!.pose as { x: number; y: number };
  return { scene, ids, store, at, press, pose, begun };
}

const rect = (x: number, y: number, size = 10) => (scene: AnyScene) =>
  [scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x, y, width: size, height: size } }) as string];

const near = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe('a move snapping through the snap session', () => {
  it('lands its own path anchor on another node\'s anchor within 6px', () => {
    const r = rig([pathSnapSource()], (scene) => [
      scene.add({ kind: 'mark', layer: 'main', data: {}, pose: pathFromD('M0 0 L20 0 L20 20 Z') }) as string,
      scene.add({ kind: 'mark', layer: 'main', data: {}, pose: pathFromD('M100 0 L120 0 L120 20 Z') }) as string,
    ]);
    // The press is 1.4 from a's anchor at (0, 0); the drag puts it at (97, 2), 3.6 from b's.
    const h = r.press({ x: 1, y: 1 });
    h.onMove!(r.at({ x: 98, y: 3 }));
    h.onEnd!(r.at({ x: 98, y: 3 }), 'commit');
    const moved = r.scene.get(asNodeId(r.ids[0]))!.pose as { coords: Float32Array };
    near({ x: moved.coords[0], y: moved.coords[1] }, { x: 100, y: 0 });
  });

  it('rounds the pose origin to a grid source', () => {
    const r = rig([grid10], rect(3, 3));
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 16, y: 9 }));
    h.onEnd!(r.at({ x: 16, y: 9 }), 'commit');
    near(r.pose(), { x: 10, y: 10 });
  });

  it('takes x from an alignment line while the grid holds y', () => {
    const r = rig([grid10, alignX(52)], rect(3, 3));
    // The box's left edge lands at 50 and its origin at y 7.
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 52, y: 9 }));
    h.onEnd!(r.at({ x: 52, y: 9 }), 'commit');
    near(r.pose(), { x: 52, y: 10 });
  });

  it('hands a binding behavior the snapped delta, and lets its translate stand', () => {
    const r = rig([alignX(52)], rect(3, 3));
    const seen: GroupTransform[] = [];
    const slot: MoveBehavior<Point> = {
      onMove: (_ctx, proposed) => { seen.push(proposed); return { transform: { kind: 'translate', dx: 100, dy: 0 } }; },
    };
    const h = r.press({ x: 5, y: 5 }, { behaviors: [slot] } as unknown as BindingOpts);
    h.onMove!(r.at({ x: 52, y: 9 }));
    expect(seen[0]).toMatchObject({ kind: 'translate', dx: expect.closeTo(49, 9), dy: expect.closeTo(4, 9) });
    h.onEnd!(r.at({ x: 52, y: 9 }), 'commit');
    near(r.pose(), { x: 103, y: 3 });
  });

  it('suspends snapping while Ctrl is held, with no marks, and snaps again once it is let go', () => {
    const r = rig([alignX(52)], rect(3, 3));
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 52, y: 9 }, { ctrl: true }));
    near(heldPose(r.scene, r.ids[0]) as Point, { x: 50, y: 7 });
    expect(r.store.get()).toEqual([]);
    h.onMove!(r.at({ x: 52, y: 9 }));
    near(heldPose(r.scene, r.ids[0]) as Point, { x: 52, y: 7 });
    expect(r.store.get()).not.toEqual([]);
    h.onEnd!(r.at({ x: 52, y: 9 }), 'commit');
    expect(r.store.get()).toEqual([]);
  });

  it('locks to the horizontal axis under Shift when the drag runs wider than tall', () => {
    const r = rig([], rect(0, 0));
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 35, y: 15 }, { shift: true }));
    h.onEnd!(r.at({ x: 35, y: 15 }, { shift: true }), 'commit');
    near(r.pose(), { x: 30, y: 0 });
  });

  it('begins no session for a press that never travels, and one for a drag', () => {
    const r = rig([alignX(52)], rect(3, 3));
    const click = r.press({ x: 5, y: 5 });
    click.onEnd!(r.at({ x: 5, y: 5 }), 'commit');
    expect(r.begun).toEqual([]);
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 30, y: 9 }));
    h.onMove!(r.at({ x: 52, y: 9 }));
    h.onEnd!(r.at({ x: 52, y: 9 }), 'commit');
    expect(r.begun).toHaveLength(1);
  });

  it('clears the marks when Escape cancels', () => {
    const r = rig([alignX(52)], rect(3, 3));
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 52, y: 9 }));
    expect(r.store.get()).not.toEqual([]);
    h.onEnd!(r.at({ x: 52, y: 9 }), 'cancel');
    expect(r.store.get()).toEqual([]);
    near(r.pose(), { x: 3, y: 3 });
  });

  it('still runs a container dwell behavior after the snap', () => {
    const r = rig([alignX(500)], (scene) => [
      ...rect(0, 0, 20)(scene),
      scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 200, y: 0, width: 200, height: 200 } }) as string,
    ]);
    const box = r.ids[1];
    const target: SnapTarget<unknown> = { parentId: box, slotPose: { x: 210, y: 10, width: 20, height: 20 } };
    const opts = {
      behaviors: [snapToContainer({ dwellMs: 0, isInstant: () => true, findTarget: (_id, wx) => (wx > 200 ? target : null) })],
    } as unknown as BindingOpts;
    const h = r.press({ x: 10, y: 10 }, opts);
    h.onMove!(r.at({ x: 260, y: 10 }));
    h.onEnd!(r.at({ x: 260, y: 10 }), 'commit');
    expect(r.scene.get(asNodeId(r.ids[0]))?.parent).toBe(box);
    expect(r.pose()).toEqual(target.slotPose);
  });
});
