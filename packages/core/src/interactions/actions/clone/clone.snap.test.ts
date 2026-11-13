/** An alt-drag clone snapping through the `snap` dep's session, as a move does. */
import { describe, expect, it } from 'vitest';
import type { BindingOptions, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import type { Point } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { createSnapOutcomeStore } from 'domains/snap/outcomeStore';
import { sceneSession2d } from 'domains/snap/sceneSession2d';
import type { SnapSource } from 'domains/snap/types';
import { drawnBoxes } from '../drawnBoxes';
import type { SnapBegin, SnapDep } from '../snapDep';
import { lastTransform } from '../transform-again/memory';
import { cloneAction } from './action';

type AnyScene = Scene<unknown, string, unknown>;

const KEYS = { alt: true, ctrl: false, meta: false, shift: false };
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

function rig(sources: readonly SnapSource[]) {
  const scene = createScene<object, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
  const id = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 3, y: 3, width: 10, height: 10 } }) as string;
  const store = createSnapOutcomeStore();
  const begun: SnapBegin[] = [];
  const snap: SnapDep = {
    begin: (req) => {
      begun.push(req);
      return sceneSession2d({ req, scene, boxes: drawnBoxes({ scene }), sources, view: () => VIEW, reachPx: 8, store });
    },
  };
  let selected: string[] = [id];
  const selection = { get: () => selected, set: (ids: string[]) => { selected = ids; } } as unknown as SelectionApi;
  const deps = { scene, selection, snap };
  let from: Point = { x: 0, y: 0 };
  const at = (p: Point, mods: Partial<typeof KEYS> = {}) => ({
    world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps,
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y } },
  }) as unknown as InvocationCtx;
  const press = (p: Point, opts: BindingOptions = {}): OngoingHandle => {
    from = p;
    return (cloneAction.invoker as OngoingInvoker).start(at(p), opts);
  };
  const copyPose = () => {
    const copy = selected[0]!;
    expect(copy).not.toBe(id);
    return scene.get(asNodeId(copy))!.pose as Point;
  };
  return { scene, id, store, at, press, copyPose, begun };
}

const near = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe('a clone snapping through the snap session', () => {
  it('declares the snap dep and the snap modifier roles', () => {
    expect(cloneAction.requires).toContain('snap');
    expect(Object.keys(cloneAction.modifierRoles ?? {})).toEqual(['snap.suspend', 'snap.constrain']);
  });

  it('previews and commits the copy where the grid holds it, and records that offset', () => {
    const r = rig([grid10]);
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 16, y: 9 }));
    near(h.previewPose!(r.id) as Point, { x: 10, y: 10 });
    h.onEnd!(r.at({ x: 16, y: 9 }), 'commit');
    near(r.copyPose(), { x: 10, y: 10 });
    near(r.scene.get(asNodeId(r.id))!.pose as Point, { x: 3, y: 3 });
    expect(lastTransform(r.scene)).toMatchObject({ kind: 'duplicate', dx: expect.closeTo(7, 9), dy: expect.closeTo(7, 9) });
    expect(r.begun).toMatchObject([{ gesture: 'move', ids: [r.id], press: { x: 5, y: 5 } }]);
  });

  it('shows marks while it drags, none under Ctrl, and clears them on release', () => {
    const r = rig([{ ...grid10, id: 'marked', *collect(q) {
      for (const p of q.probes) {
        yield { probe: p.id, locus: { at: { x: 20, y: p.at.y }, dirs: [{ x: 0, y: 1 }] }, mark: { kind: 'line', from: { x: 20, y: 0 }, to: { x: 20, y: 100 } } };
      }
    } }]);
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 21, y: 9 }));
    expect(r.store.get()).not.toEqual([]);
    h.onMove!(r.at({ x: 21, y: 9 }, { ctrl: true }));
    expect(r.store.get()).toEqual([]);
    near(h.previewPose!(r.id) as Point, { x: 19, y: 7 });
    h.onEnd!(r.at({ x: 21, y: 9 }, { ctrl: true }), 'commit');
    expect(r.store.get()).toEqual([]);
    near(r.copyPose(), { x: 19, y: 7 });
  });

  it('locks to the horizontal axis under Shift', () => {
    const r = rig([]);
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 35, y: 15 }, { shift: true }));
    h.onEnd!(r.at({ x: 35, y: 15 }, { shift: true }), 'commit');
    near(r.copyPose(), { x: 33, y: 3 });
  });

  it('lines the copy up with its own source, which stays where it was', () => {
    // Snaps a box's left edge to the left edge of any node the session offers.
    const edges: SnapSource = {
      id: 'edges', tier: 'target', reachPx: 8, roles: ['origin'],
      *collect(q) {
        const excluded = new Set(q.exclude);
        for (const node of q.scene!.renderOrderNodes()) {
          if (excluded.has(node.id)) continue;
          const x = (node.pose as Point).x;
          for (const p of q.probes) yield { probe: p.id, locus: { at: { x, y: p.at.y }, dirs: [{ x: 0, y: 1 }] } };
        }
      },
    };
    const r = rig([edges]);
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 8, y: 45 }));
    h.onEnd!(r.at({ x: 8, y: 45 }), 'commit');
    near(r.copyPose(), { x: 3, y: 43 });
  });

  it('clears the marks when Escape cancels, and makes no copy', () => {
    const r = rig([grid10]);
    const h = r.press({ x: 5, y: 5 });
    h.onMove!(r.at({ x: 16, y: 9 }));
    h.onEnd!(r.at({ x: 16, y: 9 }), 'cancel');
    expect(r.store.get()).toEqual([]);
    expect([...r.scene.roots]).toEqual([r.id]);
  });
});
