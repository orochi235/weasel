import { describe, it, expect, vi } from 'vitest';
import { overlaysOf, type InvocationCtx, type OngoingHandle } from '@weasel-js/core';
import { createReconnectAction, diagramEdgeEnds, type EndChange, type ReconnectOptions } from './reconnect';
import { EDGE_END_AFFORDANCE_KIND, createEdgeEndAffordance } from './edgeEndLayer';
import type { GraphNodeLike } from './graph';

interface Rect { x: number; y: number; width: number; height: number }

const shape = (id: string, x: number, y: number) => ({
  node: { id, kind: 'leaf', data: { diagram: {} } } as GraphNodeLike,
  pose: { x, y, width: 100, height: 40 } as Rect,
});

/** A at the origin, B 300 to its right, C below B; edge `ab` runs from A's
 *  east port to B's west port. */
const PARTICIPANTS = () => [
  shape('A', 0, 0),
  shape('B', 300, 0),
  shape('C', 300, 200),
  {
    node: {
      id: 'ab', kind: 'leaf', dependsOn: ['A', 'B'],
      data: { diagram: { from: { port: 'e' }, to: { port: 'w' }, router: 'straight' } },
    } as GraphNodeLike,
    pose: { x: 0, y: 0, width: 0, height: 0 } as Rect,
  },
];

function ctxAt(x: number, y: number, affordance?: unknown): InvocationCtx {
  return {
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    deps: {},
    drag: {
      start: { x: 300, y: 20 },
      current: { x, y },
      delta: { x: x - 300, y: y - 20 },
      ...(affordance !== undefined ? { affordance } : {}),
    },
  } as InvocationCtx;
}

const endPress = (end: 'from' | 'to', edgeId = 'ab') => ({
  kind: EDGE_END_AFFORDANCE_KIND,
  payload: { targetId: edgeId, edgeId, end },
});

function open(opts: Partial<ReconnectOptions<Rect>>, end: 'from' | 'to' = 'to'): OngoingHandle {
  const invoker = createReconnectAction<Rect>({
    participants: PARTICIPANTS, selected: () => ['ab'], ...opts,
  }).invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return invoker.start(ctxAt(end === 'to' ? 300 : 100, 20, endPress(end)));
}

describe('createReconnectAction', () => {
  it('moves the `to` end onto another shape\'s body', () => {
    const commit = vi.fn();
    open({ commit }).onEnd!(ctxAt(350, 220), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toEqual({
      edgeId: 'ab', end: 'to', target: { kind: 'body', nodeId: 'C', point: { x: 350, y: 220 } },
    } satisfies EndChange);
  });

  it('moves the `to` end onto another shape\'s port', () => {
    const commit = vi.fn();
    open({ commit }).onEnd!(ctxAt(301, 221), 'commit');
    const change = commit.mock.calls[0]![0] as EndChange;
    expect(change).toMatchObject({ edgeId: 'ab', end: 'to', target: { nodeId: 'C', id: 'w' } });
  });

  it('commits nothing when released over open canvas', () => {
    const commit = vi.fn();
    open({ commit }).onEnd!(ctxAt(200, 400), 'commit');
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits nothing when canceled over a valid target', () => {
    const commit = vi.fn();
    open({ commit }).onEnd!(ctxAt(350, 220), 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('will not move the `to` end onto the body of the shape the edge leaves', () => {
    const commit = vi.fn();
    open({ commit }).onEnd!(ctxAt(50, 20), 'commit');
    expect(commit).not.toHaveBeenCalled();
  });

  it('moves the `to` end onto another port of the shape the edge leaves', () => {
    const commit = vi.fn();
    open({ commit }).onEnd!(ctxAt(50, 40), 'commit');
    expect(commit.mock.calls[0]![0]).toMatchObject({ end: 'to', target: { nodeId: 'A', id: 's' } });
  });

  it('asks `canConnect` with the edge\'s from/to order kept for a moved `from` end', () => {
    const canConnect = vi.fn(() => true);
    const commit = vi.fn();
    open({ commit, canConnect }, 'from').onEnd!(ctxAt(350, 220), 'commit');
    expect(commit.mock.calls[0]![0]).toMatchObject({ end: 'from', target: { kind: 'body', nodeId: 'C' } });
    const asked = canConnect.mock.calls as unknown as [unknown, unknown][];
    expect(asked.some(([from, to]) =>
      (from as { nodeId: string }).nodeId === 'C' && (to as { nodeId: string; id: string }).id === 'w')).toBe(true);
  });

  it('previews the edge from its fixed end to the pointer', () => {
    const handle = open({ commit: vi.fn() });
    handle.onMove!(ctxAt(200, 400));
    expect(overlaysOf(handle)[0]).toEqual({
      kind: 'polyline', points: [{ x: 100, y: 20 }, { x: 200, y: 400 }], role: 'connector',
    });
  });

  it('declines a press that carries no edge end', () => {
    const invoker = createReconnectAction<Rect>({ participants: PARTICIPANTS, selected: () => ['ab'] }).invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    expect(invoker.start(ctxAt(10, 10, { kind: 'handle:top-left' }))).toEqual({});
  });

  it('commits with the deps handed to `start`', () => {
    const seen: unknown[] = [];
    const invoker = createReconnectAction<Rect>({
      participants: PARTICIPANTS, selected: () => ['ab'],
      commit: (_change, ctx) => seen.push(ctx.deps['scene']),
    }).invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const marker = { iAmTheScene: true };
    const start = ctxAt(300, 20, endPress('to'));
    (start as { deps: Record<string, unknown> }).deps = { scene: marker };
    invoker.start(start).onEnd!(ctxAt(350, 220), 'commit');
    expect(seen).toEqual([marker]);
  });
});

describe('the edge-end affordance', () => {
  const state = {
    selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  };

  it('puts a handle on each end of a selected edge, carrying the edge and the end', () => {
    const regions = createEdgeEndAffordance(PARTICIPANTS, () => ['ab']).regions(state as never);
    expect(regions.map((r) => r.shape)).toMatchObject([
      { kind: 'point', x: 100, y: 20 },
      { kind: 'point', x: 300, y: 20 },
    ]);
    expect(regions.map((r) => r.bind!().initialScratch)).toEqual([
      { targetId: 'ab', edgeId: 'ab', end: 'from' },
      { targetId: 'ab', edgeId: 'ab', end: 'to' },
    ]);
  });

  it('puts no handles on an edge that is not selected', () => {
    expect(createEdgeEndAffordance(PARTICIPANTS, () => []).regions(state as never)).toEqual([]);
  });

  it('comes with a contribution that binds the drag to the reconnect action', () => {
    const { layer, contribution } = diagramEdgeEnds<Rect>({ participants: PARTICIPANTS, selected: () => ['ab'] });
    expect(layer.id).toBe('diagram-edge-ends');
    expect(EDGE_END_AFFORDANCE_KIND).toBe('layer:diagram-edge-ends');
    expect(contribution.eligibility).toEqual({ claimed: true });
    expect(contribution.bindings).toEqual(expect.arrayContaining([
      { spec: { kind: 'drag', target: `affordance:${EDGE_END_AFFORDANCE_KIND}` }, actionId: 'diagram.reconnect' },
      expect.objectContaining({ spec: { kind: 'pointerDown', target: `affordance:${EDGE_END_AFFORDANCE_KIND}` } }),
      expect.objectContaining({ spec: { kind: 'click', target: `affordance:${EDGE_END_AFFORDANCE_KIND}` } }),
    ]));
  });
});
