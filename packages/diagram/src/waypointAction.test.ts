import { describe, expect, it, vi } from 'vitest';
import {
  asNodeId, createScene, createSnapOutcomeStore, pathFromD, pathSnapSource,
  type ImmediateInvoker, type InvocationCtx, type SnapDep, type SnapOutcomeStore, type SnapSource,
} from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';
import type { Vec2 } from '@weasel-js/core/math';
import type { GraphNodeLike } from './graph';
import { WAYPOINT_AFFORDANCE_KIND } from './waypointLayer';
import { createRemoveWaypointAction } from './routeCommands';
import { createRouteEditAction, type RouteEdit, type RouteEditOptions } from './waypointAction';
import type { RouteHandle } from './waypoints';

interface Rect { x: number; y: number; width: number; height: number }
type AnyScene = Parameters<typeof createSnapSession2dForTests>[0]['scene'];
type Mods = Partial<typeof KEYS>;

const KEYS = { alt: false, shift: false, meta: false, ctrl: false };

const shape = (id: string, x: number, y: number) => ({
  node: { id, kind: 'leaf', data: { diagram: {} } } as GraphNodeLike,
  pose: { x, y, width: 100, height: 40 } as Rect,
});

const edge = (id: string, to: string, diagram: Record<string, unknown>) => ({
  node: { id, kind: 'leaf', dependsOn: ['A', to], data: { diagram: { from: { port: 'e' }, to: { port: 'w' }, ...diagram }, stroke: 1 } } as GraphNodeLike,
  pose: { x: 0, y: 0, width: 0, height: 0 } as Rect,
});

/** A at the origin, B 300 to its right, C below B. `ab` runs straight from
 *  (100, 20) to (300, 20) through `waypoints`; `ac` runs orthogonal from
 *  (100, 20) out to x = 200, down to y = 220, and in to (300, 220). */
const participants = (waypoints: Vec2[] = []) => () => [
  shape('A', 0, 0), shape('B', 300, 0), shape('C', 300, 200),
  edge('ab', 'B', { router: 'straight', ...(waypoints.length > 0 ? { waypoints, laidOut: waypoints } : {}) }),
  edge('ac', 'C', { router: 'orthogonal' }),
];

const press = (edgeId: string, handle: RouteHandle) => ({
  kind: WAYPOINT_AFFORDANCE_KIND,
  payload: { targetId: edgeId, edgeId, handle },
});

/** Grid lines every `step` on both axes, for pointer probes. */
const grid = (step: number): SnapSource => ({
  id: 'grid', tier: 'fallback', reachPx: Infinity, roles: ['origin', 'pointer'],
  *collect(q) {
    for (const p of q.probes) {
      yield { probe: p.id, locus: { at: { x: Math.round(p.at.x / step) * step, y: p.at.y }, dirs: [{ x: 0, y: 1 }] } };
      yield { probe: p.id, locus: { at: { x: p.at.x, y: Math.round(p.at.y / step) * step }, dirs: [{ x: 1, y: 0 }] } };
    }
  },
});

const emptyScene = () => createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;

/** A `snap` dep as a canvas builds it: `canvas` less the gesture's `omit`,
 *  then the gesture's own `sources`, at a zoom of `scale`. */
function canvasSnap(
  canvas: readonly SnapSource[],
  o: { scene?: AnyScene; scale?: number; store?: SnapOutcomeStore } = {},
): SnapDep {
  const scene = o.scene ?? emptyScene();
  const scale = o.scale ?? 1;
  const store = o.store ?? createSnapOutcomeStore();
  return {
    begin: ({ plane: _plane, sources = [], omit = [], ...req }) => createSnapSession2dForTests({
      scene, view: { x: 0, y: 0, scale: { x: scale, y: scale } }, reachPx: 8, store,
      sources: [...canvas.filter((s) => !omit.includes(s.id)), ...sources], ...req,
    }),
  };
}

interface CtxOpts { affordance?: unknown; scale?: number; snap?: SnapDep; mods?: Mods }

function ctxAt(start: Vec2, x: number, y: number, o: CtxOpts = {}): InvocationCtx {
  const scale = o.scale ?? 1;
  return {
    world: { x, y },
    screen: { x, y },
    modifiers: { ...KEYS, ...o.mods },
    deps: { view: { get: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }) }, ...(o.snap ? { snap: o.snap } : {}) },
    drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y }, ...(o.affordance !== undefined ? { affordance: o.affordance } : {}) },
  } as unknown as InvocationCtx;
}

function open(
  opts: Partial<RouteEditOptions<Rect>>, edgeId: string, handle: RouteHandle, waypoints: Vec2[] = [],
  o: Omit<CtxOpts, 'affordance'> = {},
) {
  const invoker = createRouteEditAction<Rect>({ participants: participants(waypoints), selected: () => [edgeId], ...opts }).invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const start = handle.at;
  const handleOf = invoker.start(ctxAt(start, start.x, start.y, { ...o, affordance: press(edgeId, handle) }));
  return { handle: handleOf, at: (x: number, y: number) => ctxAt(start, x, y, o) };
}

/** The waypoints committed by dragging `handle` of `edgeId` to `to`. */
function dragTo(
  edgeId: string, handle: RouteHandle, to: Vec2, o: Omit<CtxOpts, 'affordance'> & { waypoints?: Vec2[] } = {},
): readonly Vec2[] | undefined {
  const commit = vi.fn();
  const { waypoints = [], ...ctxOpts } = o;
  const { handle: h, at } = open({ commit }, edgeId, handle, waypoints, ctxOpts);
  h.onMove!(at(to.x, to.y));
  h.onEnd!(at(to.x, to.y), 'commit');
  return (commit.mock.calls[0]?.[0] as RouteEdit | undefined)?.waypoints;
}

const waypointsOf = (data: unknown) => ((data as { diagram: { waypoints?: Vec2[] } }).diagram.waypoints);

const VERTEX: RouteHandle = { kind: 'vertex', index: 0, at: { x: 200, y: 100 } };
const ONE_BEND = [{ x: 200, y: 100 }];
const AC_UPRIGHT: RouteHandle = { kind: 'segment', index: 1, axis: 'y', at: { x: 200, y: 120 } };

describe('createRouteEditAction', () => {
  it('inserts a waypoint from a leg\'s hollow dot, previewing the edge as the commit writes it', () => {
    const commit = vi.fn();
    const { handle, at } = open({ commit }, 'ab', { kind: 'insert', leg: 0, at: { x: 200, y: 20 } });
    handle.onMove!(at(210, 100));
    expect([...handle.previewIds!()!]).toEqual(['ab']);
    const preview = handle.previewData!('ab');
    expect(waypointsOf(preview)).toEqual([{ x: 210, y: 100 }]);
    expect((preview as { stroke: unknown }).stroke).toBe(1);
    handle.onEnd!(at(210, 100), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toEqual({ edgeId: 'ab', waypoints: [{ x: 210, y: 100 }] } satisfies RouteEdit);
  });

  it('keeps the grab offset when a dot is pressed off its center', () => {
    const commit = vi.fn();
    const invoker = createRouteEditAction<Rect>({ participants: participants(ONE_BEND), selected: () => ['ab'], commit }).invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const start = { x: 203, y: 102 };
    const handle = invoker.start(ctxAt(start, start.x, start.y, { affordance: press('ab', VERTEX) }));
    handle.onEnd!(ctxAt(start, 233, 152), 'commit');
    expect(commit.mock.calls[0]![0].waypoints).toEqual([{ x: 230, y: 150 }]);
  });

  it('writes nothing when canceled', () => {
    const commit = vi.fn();
    const { handle, at } = open({ commit }, 'ab', { kind: 'insert', leg: 0, at: { x: 200, y: 20 } });
    handle.onMove!(at(210, 100));
    handle.onEnd!(at(210, 100), 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('writes nothing for a press released where it began', () => {
    const commit = vi.fn();
    const { handle, at } = open({ commit }, 'ab', { kind: 'insert', leg: 0, at: { x: 200, y: 20 } });
    handle.onEnd!(at(200, 20), 'commit');
    expect(commit).not.toHaveBeenCalled();
  });

  it('slides an orthogonal segment and writes every bend of the new route', () => {
    expect(dragTo('ac', AC_UPRIGHT, { x: 240, y: 130 })).toEqual([{ x: 240, y: 20 }, { x: 240, y: 220 }]);
  });

  it('snaps a dot into line with a neighboring stop within 6 screen pixels', () => {
    const snap = canvasSnap([]);
    expect(dragTo('ab', VERTEX, { x: 104, y: 97 }, { waypoints: ONE_BEND, snap })).toEqual([{ x: 100, y: 97 }]);
    expect(dragTo('ab', VERTEX, { x: 110, y: 97 }, { waypoints: ONE_BEND, snap })).toEqual([{ x: 110, y: 97 }]);
  });

  it('measures the snap in screen pixels', () => {
    const snap = canvasSnap([], { scale: 4 });
    expect(dragTo('ab', VERTEX, { x: 104, y: 97 }, { waypoints: ONE_BEND, snap, scale: 4 })).toEqual([{ x: 104, y: 97 }]);
  });

  it('snaps a sliding segment into line with a port', () => {
    const snap = canvasSnap([]);
    // In line with A's port at y = 20, the bend at x = 200 goes, and C's port end keeps its jog.
    expect(dragTo('ac', { kind: 'segment', index: 2, axis: 'x', at: { x: 250, y: 220 } }, { x: 250, y: 24 }, { snap }))
      .toEqual([{ x: 284, y: 20 }, { x: 284, y: 220 }]);
  });

  it('a vertex aligns to a neighbor on y and takes the grid on x', () => {
    const snap = canvasSnap([grid(10)]);
    const second: RouteHandle = { kind: 'vertex', index: 1, at: { x: 200, y: 100 } };
    expect(dragTo('ab', second, { x: 33, y: 52 }, { waypoints: [{ x: 200, y: 50 }, { x: 200, y: 100 }], snap }))
      .toEqual([{ x: 200, y: 50 }, { x: 30, y: 50 }]);
  });

  it('a segment drag stays on its axis under Shift and Ctrl', () => {
    const snap = canvasSnap([grid(10)]);
    expect(dragTo('ac', AC_UPRIGHT, { x: 243, y: 137 }, { snap, mods: { shift: true } }))
      .toEqual([{ x: 240, y: 20 }, { x: 240, y: 220 }]);
    expect(dragTo('ac', AC_UPRIGHT, { x: 243, y: 137 }, { snap, mods: { ctrl: true } }))
      .toEqual([{ x: 243, y: 20 }, { x: 243, y: 220 }]);
  });

  it('Ctrl suspends every snap', () => {
    const snap = canvasSnap([grid(10)]);
    expect(dragTo('ab', VERTEX, { x: 104, y: 97 }, { waypoints: ONE_BEND, snap })).toEqual([{ x: 100, y: 100 }]);
    expect(dragTo('ab', VERTEX, { x: 104, y: 97 }, { waypoints: ONE_BEND, snap, mods: { ctrl: true } })).toEqual([{ x: 104, y: 97 }]);
  });

  it('Shift locks a vertex to 45° steps', () => {
    const snap = canvasSnap([]);
    expect(dragTo('ab', VERTEX, { x: 230, y: 103 }, { waypoints: ONE_BEND, snap, mods: { shift: true } })).toEqual([{ x: 230, y: 100 }]);
    expect(dragTo('ab', VERTEX, { x: 231, y: 129 }, { waypoints: ONE_BEND, snap, mods: { shift: true } })).toEqual([{ x: 230, y: 130 }]);
  });

  it('route marks reach the readout store', () => {
    const store = createSnapOutcomeStore();
    const { handle, at } = open({ commit: vi.fn() }, 'ab', VERTEX, ONE_BEND, { snap: canvasSnap([], { store }) });
    handle.onMove!(at(104, 97));
    expect(store.get()).toEqual([{ kind: 'line', from: { x: 100, y: 20 }, to: { x: 100, y: 97 } }]);
    handle.onEnd!(at(104, 97), 'commit');
    expect(store.get()).toEqual([]);
  });

  it('draws no guides of its own', () => {
    const { handle, at } = open({ commit: vi.fn() }, 'ab', VERTEX, ONE_BEND, { snap: canvasSnap([]) });
    handle.onMove!(at(104, 97));
    expect(handle.overlay).toBeUndefined();
  });

  it('with no snap dep the drag is unsnapped and a segment keeps its axis', () => {
    expect(dragTo('ab', VERTEX, { x: 104, y: 97 }, { waypoints: ONE_BEND })).toEqual([{ x: 104, y: 97 }]);
    expect(dragTo('ac', AC_UPRIGHT, { x: 243, y: 137 })).toEqual([{ x: 243, y: 20 }, { x: 243, y: 220 }]);
  });

  it('the edited edge and shape anchors offer nothing', () => {
    const scene = emptyScene();
    scene.add({ kind: 'leaf', layer: 'main', id: asNodeId('Z'), data: {}, pose: pathFromD('M150 150 L160 160') } as never);
    scene.add({ kind: 'leaf', layer: 'main', id: asNodeId('ab'), data: {}, pose: pathFromD('M250 250 L260 260') } as never);
    const pathSnap: SnapSource = { ...pathSnapSource({ only: ['anchor'] }), gestures: ['point'] };
    expect(pathSnap.id).toBe('path-snap');
    expect(dragTo('ab', VERTEX, { x: 152, y: 152 }, { waypoints: ONE_BEND, snap: canvasSnap([pathSnap], { scene }) }))
      .toEqual([{ x: 152, y: 152 }]);
    // The same anchors under another id do snap, so the scene itself offers them.
    const anchors: SnapSource = { ...pathSnap, id: 'anchors' };
    expect(dragTo('ab', VERTEX, { x: 152, y: 152 }, { waypoints: ONE_BEND, snap: canvasSnap([anchors], { scene }) }))
      .toEqual([{ x: 150, y: 150 }]);
    expect(dragTo('ab', VERTEX, { x: 252, y: 252 }, { waypoints: ONE_BEND, snap: canvasSnap([anchors], { scene }) }))
      .toEqual([{ x: 252, y: 252 }]);
  });
});

describe('createRemoveWaypointAction', () => {
  const run = (opts: Partial<RouteEditOptions<Rect>>, edgeId: string, handle: RouteHandle, waypoints: Vec2[] = []) =>
    (createRemoveWaypointAction<Rect>({ participants: participants(waypoints), selected: () => [edgeId], ...opts }).invoker as ImmediateInvoker)
      .run({} as never, { worldX: handle.at.x, worldY: handle.at.y, affordance: press(edgeId, handle) });

  it('removes a waypoint on a double-click of its dot', () => {
    const commit = vi.fn();
    run({ commit }, 'ab', { kind: 'vertex', index: 0, at: { x: 200, y: 100 } }, [{ x: 200, y: 100 }]);
    expect(commit.mock.calls[0]![0]).toEqual({ edgeId: 'ab', waypoints: [] });
  });

  it('does nothing on a leg\'s hollow dot, or a segment it cannot straighten', () => {
    const commit = vi.fn();
    run({ commit }, 'ab', { kind: 'insert', leg: 0, at: { x: 200, y: 20 } });
    run({ commit }, 'ac', { kind: 'segment', index: 1, axis: 'y', at: { x: 200, y: 120 } });
    expect(commit).not.toHaveBeenCalled();
  });

  it('declines where it would remove nothing, so the double-click reaches what is under the handle', () => {
    const enabledAt = (edgeId: string, x: number, y: number, waypoints: Vec2[] = []) =>
      createRemoveWaypointAction<Rect>({ participants: participants(waypoints), selected: () => [edgeId] }).enabled!({} as never, { x, y });
    expect(enabledAt('ab', 203, 98, [{ x: 200, y: 100 }])).toBe(true);
    expect(enabledAt('ab', 200, 20)).not.toBe(true);
    expect(enabledAt('ac', 200, 120)).not.toBe(true);
    expect(enabledAt('ab', 230, 100, [{ x: 200, y: 100 }])).not.toBe(true);
  });
});
