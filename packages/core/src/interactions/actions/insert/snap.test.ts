/** An insert snapping through the `snap` dep's `point` sessions. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import { gridSource, lineSource, sessionDep } from 'features/snap/testing/sessionDep';
import type { SnapSource } from 'features/snap/types';
import type { InsertDep, InsertExtras, SnapDep } from '../depSchema';
import type { InsertBehavior } from '../../gestures/types';
import { insertAction } from './action';
import { insertRepositionAction } from './repositionAction';

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };
type AnyScene = Scene<unknown, string, unknown>;

const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

/** Every node's left and right edges, as vertical lines: a sibling's edges. */
const edges: SnapSource = {
  id: 'edges', roles: ['pointer'],
  *collect(q) {
    for (const node of q.scene?.nodes.values() ?? []) {
      const b = node.pose as Bounds;
      for (const x of [b.x, b.x + b.width]) {
        for (const p of q.probes) yield { probe: p.id, locus: { at: { x, y: 0 }, dirs: [{ x: 0, y: 1 }] } };
      }
    }
  },
};

function rig(sources: readonly SnapSource[] | null, siblings: readonly Bounds[] = []) {
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
  for (const pose of siblings) scene.add({ kind: 'leaf', layer: 'main', data: {}, pose });
  const committed: Array<{ bounds: Bounds; extras: InsertExtras }> = [];
  const insert: InsertDep = {
    commit: (bounds, extras) => { committed.push({ bounds: { ...bounds }, extras }); return 'n' as NodeId; },
  };
  const snap: SnapDep | null = sources ? sessionDep(scene, sources) : null;
  const deps = { insert, insertLive: { gesture: null }, ...(snap ? { snap } : {}) };
  const at = (p: Point, mods: Partial<typeof KEYS> = {}) =>
    ({ world: p, screen: p, modifiers: { ...KEYS, ...mods }, deps }) as unknown as InvocationCtx;
  /** Drag `kind` from `from` to `to` and release. */
  const draw = (
    kind: string, from: Point, to: Point, mods: Partial<typeof KEYS> = {},
    opts: { behaviors?: InsertBehavior<unknown>[]; pressMods?: Partial<typeof KEYS> } = {},
  ) => {
    const h = (insertAction.invoker as OngoingInvoker).start(
      at(from, opts.pressMods), { params: { kind }, ...(opts.behaviors ? { behaviors: opts.behaviors } : {}) },
    );
    h.onMove!(at(to, mods));
    h.onEnd!(at(to, mods), 'commit');
    return committed.at(-1)!;
  };
  return { at, draw, committed };
}

describe('insert snapping', () => {
  it('starts a rect on a grid point and ends it on a sibling\'s edge', () => {
    const r = rig([gridSource(10), edges], [{ x: 200, y: 0, width: 50, height: 50 }]);
    const { bounds } = r.draw('rect', { x: 3, y: 4 }, { x: 196, y: 83 });
    expect(bounds).toEqual({ x: 0, y: 0, width: 200, height: 80 });
  });

  it('lands a Shift line where the 15° line through its start meets a guide', () => {
    const r = rig([lineSource({ x: 100, y: 0 }, { x: 0, y: 1 })]);
    // 100,30 is about 16.7° from the start: the 15° line meets x = 100 at
    // y = 100 tan 15°, where the step alone would have kept the drag's length.
    const { extras } = r.draw('line', { x: 0, y: 0 }, { x: 98, y: 30 }, { shift: true });
    const b = (extras as unknown as { b: Point }).b;
    expect(b.x).toBeCloseTo(100, 9);
    expect(b.y).toBeCloseTo(100 * Math.tan(Math.PI / 12), 9);
  });

  it('turns a Shift line about its snapped start', () => {
    const r = rig([gridSource(10)]);
    const { extras } = r.draw('line', { x: 3, y: 4 }, { x: 101, y: 13 }, { shift: true });
    expect(extras).toMatchObject({ a: { x: 0, y: 0 } });
    expect((extras as unknown as { b: Point }).b.y).toBeCloseTo(0, 9);
  });

  it('keeps Shift\'s 15° step with no snap dep, at the pointer\'s nearest point on it', () => {
    const { extras } = rig(null).draw('line', { x: 0, y: 0 }, { x: 100, y: 10 }, { shift: true });
    const b = (extras as unknown as { b: Point }).b;
    expect(b.y).toBeCloseTo(0, 9);
    expect(b.x).toBeCloseTo(100, 9);
  });

  it('leaves the end free while Ctrl suspends snapping', () => {
    const r = rig([gridSource(10)]);
    const { bounds } = r.draw('rect', { x: 0, y: 0 }, { x: 47, y: 52 }, { ctrl: true });
    expect(bounds).toEqual({ x: 0, y: 0, width: 47, height: 52 });
  });

  it('keeps a carried start on the grid', () => {
    const r = rig([gridSource(10)]);
    const h = (insertAction.invoker as OngoingInvoker).start(r.at({ x: 0, y: 0 }), { params: { kind: 'rect' } });
    h.onMove!(r.at({ x: 31, y: 19 }));
    (insertRepositionAction.invoker as OngoingInvoker).start(r.at({ x: 0, y: 0 }), undefined);
    // Carried by (16, 7) from 0,0: lands on 20,10.
    h.onMove!(r.at({ x: 47, y: 26 }));
    h.onEnd!(r.at({ x: 47, y: 26 }), 'commit');
    expect(r.committed[0]!.bounds).toEqual({ x: 20, y: 10, width: 30, height: 20 });
  });

  it('snaps an Alt-centered rect\'s center at press and its corner each frame', () => {
    const r = rig([gridSource(10)]);
    const { bounds } = r.draw('rect', { x: 3, y: 4 }, { x: 47, y: 52 }, { alt: true }, { pressMods: { alt: true } });
    expect(bounds).toEqual({ x: -50, y: -50, width: 100, height: 100 });
  });

  it('keeps a held start where the session put it, over a behavior\'s onStart', () => {
    const moveStart: InsertBehavior<unknown> = {
      onStart(ctx) { ctx.origin.set(ctx.draggedIds[0], { x: 3, y: 3 }); },
    };
    expect(rig([gridSource(10)]).draw('rect', { x: 13, y: 14 }, { x: 40, y: 40 }, {}, { behaviors: [moveStart] }).bounds)
      .toEqual({ x: 10, y: 10, width: 30, height: 30 });
    expect(rig(null).draw('rect', { x: 13, y: 14 }, { x: 40, y: 40 }, {}, { behaviors: [moveStart] }).bounds)
      .toEqual({ x: 3, y: 3, width: 37, height: 37 });
  });

  describe('the container a new node lands in', () => {
    /** A scene with a container `g` and a leaf `l`, and a drawn rect whose
     *  `insertInto` names `into`: the `parent` each collect was told. */
    function drawInto(into: (ids: { g: string; l: string }) => string | null) {
      const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
      const g = scene.add({ kind: 'container', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } }) as string;
      const l = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 } }) as string;
      const told: Array<string | undefined> = [];
      const spy: SnapSource = { id: 'spy', roles: ['pointer'], *collect(q) { told.push(q.parent); } };
      const insert: InsertDep = { commit: () => 'n' as NodeId };
      const deps = {
        scene, insert, insertLive: { gesture: null },
        insertInto: { get: () => into({ g, l }) },
        snap: sessionDep(scene, [spy]),
      };
      const at = (p: Point) => ({ world: p, screen: p, modifiers: KEYS, deps }) as unknown as InvocationCtx;
      const h = (insertAction.invoker as OngoingInvoker).start(at({ x: 1, y: 1 }), { params: { kind: 'rect' } });
      h.onMove!(at({ x: 5, y: 5 }));
      h.onEnd!(at({ x: 5, y: 5 }), 'commit');
      return { told, g };
    }

    it('is told to every session, the start\'s and the end\'s', () => {
      const { told, g } = drawInto(({ g }) => g);
      expect(told.length).toBeGreaterThan(1);
      expect(new Set(told)).toEqual(new Set([g]));
    });

    it('is the top of the tree when insertInto names no container', () => {
      expect(new Set(drawInto(({ l }) => l).told)).toEqual(new Set([undefined]));
      expect(new Set(drawInto(() => null).told)).toEqual(new Set([undefined]));
    });
  });
});
