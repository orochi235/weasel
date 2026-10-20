import { describe, expect, it, vi } from 'vitest';
import { overlaysOf, type ImmediateInvoker, type InvocationCtx } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { GraphNodeLike } from './graph';
import { WAYPOINT_AFFORDANCE_KIND } from './waypointLayer';
import { createRemoveWaypointAction, createRouteEditAction, type RouteEdit, type RouteEditOptions } from './waypointAction';
import type { RouteHandle } from './waypoints';

interface Rect { x: number; y: number; width: number; height: number }

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

function ctxAt(start: Vec2, x: number, y: number, affordance?: unknown, scale = 1): InvocationCtx {
  return {
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    deps: { view: { get: () => ({ x: 0, y: 0, scale: { x: scale, y: scale } }) } },
    drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y }, ...(affordance !== undefined ? { affordance } : {}) },
  } as unknown as InvocationCtx;
}

function open(opts: Partial<RouteEditOptions<Rect>>, edgeId: string, handle: RouteHandle, waypoints: Vec2[] = []) {
  const invoker = createRouteEditAction<Rect>({ participants: participants(waypoints), selected: () => [edgeId], ...opts }).invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const start = handle.at;
  const handleOf = invoker.start(ctxAt(start, start.x, start.y, press(edgeId, handle)));
  return { handle: handleOf, at: (x: number, y: number) => ctxAt(start, x, y) };
}

const waypointsOf = (data: unknown) => ((data as { diagram: { waypoints?: Vec2[] } }).diagram.waypoints);

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
    const invoker = createRouteEditAction<Rect>({ participants: participants([{ x: 200, y: 100 }]), selected: () => ['ab'], commit }).invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const start = { x: 203, y: 102 };
    const handle = invoker.start(ctxAt(start, start.x, start.y, press('ab', { kind: 'vertex', index: 0, at: { x: 200, y: 100 } })));
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

  it('snaps a dot into line with a neighboring stop within 6 screen pixels, and draws the guide', () => {
    const commit = vi.fn();
    const { handle, at } = open({ commit }, 'ab', { kind: 'vertex', index: 0, at: { x: 200, y: 100 } }, [{ x: 200, y: 100 }]);
    handle.onMove!(at(104, 97));
    expect(waypointsOf(handle.previewData!('ab'))).toEqual([{ x: 100, y: 97 }]);
    expect(overlaysOf(handle)).toEqual([{ kind: 'polyline', points: [{ x: 100, y: 20 }, { x: 100, y: 97 }], role: 'guide' }]);
    handle.onMove!(at(110, 97));
    expect(waypointsOf(handle.previewData!('ab'))).toEqual([{ x: 110, y: 97 }]);
    expect(overlaysOf(handle)).toEqual([]);
  });

  it('measures the snap in screen pixels', () => {
    const commit = vi.fn();
    const invoker = createRouteEditAction<Rect>({ participants: participants([{ x: 200, y: 100 }]), selected: () => ['ab'], commit }).invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const start = { x: 200, y: 100 };
    const handle = invoker.start(ctxAt(start, 200, 100, press('ab', { kind: 'vertex', index: 0, at: start }), 4));
    handle.onEnd!(ctxAt(start, 104, 97, undefined, 4), 'commit');
    expect(commit.mock.calls[0]![0].waypoints).toEqual([{ x: 104, y: 97 }]);
  });

  it('slides an orthogonal segment and writes every bend of the new route', () => {
    const commit = vi.fn();
    const { handle, at } = open({ commit }, 'ac', { kind: 'segment', index: 1, axis: 'y', at: { x: 200, y: 120 } });
    handle.onEnd!(at(240, 130), 'commit');
    expect(commit.mock.calls[0]![0]).toEqual({ edgeId: 'ac', waypoints: [{ x: 240, y: 20 }, { x: 240, y: 220 }] });
  });

  it('snaps a sliding segment into line with a port', () => {
    const commit = vi.fn();
    const { handle, at } = open({ commit }, 'ac', { kind: 'segment', index: 2, axis: 'x', at: { x: 250, y: 220 } });
    handle.onEnd!(at(250, 24), 'commit');
    // In line with A's port at y = 20, the bend at x = 200 goes, and C's port end keeps its jog.
    expect(commit.mock.calls[0]![0].waypoints).toEqual([{ x: 284, y: 20 }, { x: 284, y: 220 }]);
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
});
