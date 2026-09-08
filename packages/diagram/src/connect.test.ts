import { describe, it, expect, vi } from 'vitest';
import type { InvocationCtx, OngoingHandle, Vec2 } from '@weasel-js/core';
import { createConnectAction, type PendingEdge } from './connect';
import type { DiagramNodeLike } from './trait';
import type { Port } from './types';

interface Rect { x: number; y: number; width: number; height: number }

const node = (data: unknown, id: string): DiagramNodeLike => ({ id, kind: 'leaf', data });

/** Two 100×40 participants, 200 apart on the x axis. */
const PARTICIPANTS = () => [
  { node: node({ diagram: {} }, 'a'), pose: { x: 0, y: 0, width: 100, height: 40 } as Rect },
  { node: node({ diagram: {} }, 'b'), pose: { x: 300, y: 0, width: 100, height: 40 } as Rect },
];

/** `a`'s east port, where a connect drag starts. */
const A_EAST: Port = { id: 'e', nodeId: 'a', point: { x: 100, y: 20 }, normal: { x: 1, y: 0 } };

function ctxAt(x: number, y: number, affordance?: unknown): InvocationCtx {
  return {
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    deps: {},
    drag: {
      start: { x: 100, y: 20 },
      current: { x, y },
      delta: { x: x - 100, y: y - 20 },
      ...(affordance !== undefined ? { affordance } : {}),
    },
  } as InvocationCtx;
}

const portPress = (port: Port = A_EAST) => ({
  kind: 'layer:diagram-ports',
  payload: { targetId: port.nodeId, nodeId: port.nodeId, portId: port.id, port },
});

describe('createConnectAction', () => {
  it('commits one edge between the port it started on and the port it ended on', () => {
    const commit = vi.fn();
    const handle = open({ participants: PARTICIPANTS, commit });
    // Release on `b`'s west port.
    handle!.onEnd!(ctxAt(300, 20), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    const edge = commit.mock.calls[0]![0] as PendingEdge;
    expect(edge.from).toMatchObject({ nodeId: 'a', id: 'e' });
    expect(edge.to).toMatchObject({ nodeId: 'b', id: 'w' });
  });

  it('declines a press that carries no port', () => {
    const action = createConnectAction<Rect>({ participants: PARTICIPANTS, commit: vi.fn() });
    const invoker = action.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const handle = invoker.start(ctxAt(10, 10, { kind: 'handle:top-left' }));
    // An empty handle is how the dispatcher is told to fall through.
    expect(handle).toEqual({});
  });

  /** Two typed participants: `a`'s ports are `num`, `b`'s are `str`. */
  const TYPED = () => [
    {
      node: node({ diagram: { ports: [{ id: 'e', at: { u: 1, v: 0.5 }, type: 'num' }] } }, 'a'),
      pose: { x: 0, y: 0, width: 100, height: 40 } as Rect,
    },
    {
      node: node({ diagram: { ports: [{ id: 'w', at: { u: 0, v: 0.5 }, type: 'str' }] } }, 'b'),
      pose: { x: 300, y: 0, width: 100, height: 40 } as Rect,
    },
  ];
  const A_EAST_NUM: Port = { ...A_EAST, type: 'num' };

  /** The last point of the previewed edge — where releasing would land it. */
  function previewEnd(handle: OngoingHandle): Vec2 {
    const overlay = handle.overlay!() as unknown as { commands: { path: unknown }[] };
    const path = overlay.commands[0]!.path as { coords: Float32Array };
    return { x: path.coords[path.coords.length - 2]!, y: path.coords[path.coords.length - 1]! };
  }

  function open(opts: Parameters<typeof createConnectAction<Rect>>[0], port = A_EAST) {
    const action = createConnectAction<Rect>(opts);
    const invoker = action.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    return invoker.start(ctxAt(port.point.x, port.point.y, portPress(port)))!;
  }

  it('snaps the preview to a port the pointer comes near', () => {
    const handle = open({ participants: PARTICIPANTS, commit: vi.fn() });
    handle.onMove!(ctxAt(295, 22));
    // `b`'s west port is at (300, 20) — the preview ends there, not at (295, 22).
    expect(previewEnd(handle)).toEqual({ x: 300, y: 20 });
  });

  it('runs the preview to the bare pointer when no port is in reach', () => {
    const handle = open({ participants: PARTICIPANTS, commit: vi.fn() });
    handle.onMove!(ctxAt(200, 100));
    expect(previewEnd(handle)).toEqual({ x: 200, y: 100 });
  });

  it('will not snap to a port `canConnect` refuses', () => {
    const handle = open({ participants: TYPED, commit: vi.fn() }, A_EAST_NUM);
    // Near `b`'s west port (300, 20) but not on it — the offset is what tells
    // "snapped to the port" apart from "still following the cursor". `b`'s only
    // port is `str`, so an illegal port is never a candidate and the edge stays
    // on the pointer.
    handle.onMove!(ctxAt(295, 22));
    expect(previewEnd(handle)).toEqual({ x: 295, y: 22 });
  });

  it('commits nothing when released where `canConnect` refuses', () => {
    const commit = vi.fn();
    const handle = open({ participants: TYPED, commit }, A_EAST_NUM);
    handle.onEnd!(ctxAt(295, 22), 'commit');
    expect(commit).not.toHaveBeenCalled();
  });

  it('joins two ports that declare the same type', () => {
    const commit = vi.fn();
    const same = () => [
      TYPED()[0]!,
      {
        node: node({ diagram: { ports: [{ id: 'w', at: { u: 0, v: 0.5 }, type: 'num' }] } }, 'b'),
        pose: { x: 300, y: 0, width: 100, height: 40 } as Rect,
      },
    ];
    const handle = open({ participants: same, commit }, A_EAST_NUM);
    handle.onEnd!(ctxAt(300, 20), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('commits nothing when released over open canvas', () => {
    const commit = vi.fn();
    const handle = open({ participants: PARTICIPANTS, commit });
    handle.onEnd!(ctxAt(200, 200), 'commit');
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits nothing when the gesture is canceled over a valid port', () => {
    const commit = vi.fn();
    const handle = open({ participants: PARTICIPANTS, commit });
    handle.onEnd!(ctxAt(300, 20), 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('refuses to join a port to itself', () => {
    const commit = vi.fn();
    const handle = open({ participants: PARTICIPANTS, commit });
    handle.onEnd!(ctxAt(100, 20), 'commit');
    expect(commit).not.toHaveBeenCalled();
  });

  it('stops previewing once the gesture has ended', () => {
    const handle = open({ participants: PARTICIPANTS, commit: vi.fn() });
    handle.onEnd!(ctxAt(300, 20), 'commit');
    expect(handle.overlay!()).toBeNull();
  });

  it('commits with the deps handed to `start`, not the empty bag `onEnd` gets', () => {
    // The dispatcher builds the deps bag once, on `start`; every later pump
    // event carries `deps: {}`. An action that reads a dep at commit time reads
    // nothing, and the commit silently does nothing at all.
    const seen: unknown[] = [];
    const action = createConnectAction<Rect>({
      participants: PARTICIPANTS,
      commit: (_edge, ctx) => seen.push(ctx.deps['scene']),
    });
    const invoker = action.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const marker = { iAmTheScene: true };
    const start = ctxAt(100, 20, portPress());
    (start as { deps: Record<string, unknown> }).deps = { scene: marker };
    const handle = invoker.start(start);
    const end = ctxAt(300, 20);
    (end as { deps: Record<string, unknown> }).deps = {};
    handle.onEnd!(end, 'commit');
    expect(seen).toEqual([marker]);
  });
});
