import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { InvocationCtx } from '@weasel-js/core';
import type { PendingEdge } from './connect';
import { CONNECTOR_ACTION_ID, CONNECTOR_TOOL_ID, useConnectorTool } from './connectorTool';
import type { DiagramNodeLike } from './trait';

interface Rect { x: number; y: number; width: number; height: number }

const node = (id: string): DiagramNodeLike => ({ id, kind: 'leaf', data: { diagram: {} } });
const PARTICIPANTS = () => [
  { node: node('a'), pose: { x: 0, y: 0, width: 100, height: 40 } as Rect },
  { node: node('b'), pose: { x: 300, y: 0, width: 100, height: 40 } as Rect },
];

function ctxAt(x: number, y: number): InvocationCtx {
  return {
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    deps: {},
    drag: { start: { x: 50, y: 20 }, current: { x, y }, delta: { x: x - 50, y: y - 20 } },
  } as InvocationCtx;
}

function connectorInvoker(opts: Parameters<typeof useConnectorTool<Rect>>[0]) {
  const { result } = renderHook(() => useConnectorTool<Rect>(opts));
  const invoker = result.current.actions![0]!.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return invoker;
}

describe('useConnectorTool', () => {
  it('binds a drag to the connector action it declares', () => {
    const { result } = renderHook(() => useConnectorTool<Rect>({ participants: PARTICIPANTS }));
    const tool = result.current;
    expect(tool.id).toBe(CONNECTOR_TOOL_ID);
    expect(tool.bindings).toEqual([{ spec: { kind: 'drag' }, actionId: CONNECTOR_ACTION_ID }]);
    expect(tool.actions?.map((a) => a.id)).toEqual([CONNECTOR_ACTION_ID]);
    expect(tool.presentation?.icon).toBe('core:arrow');
  });

  it('draws a body-to-body edge from a drag between two shapes', () => {
    const commit = vi.fn();
    const handle = connectorInvoker({ participants: PARTICIPANTS, commit }).start(ctxAt(50, 20));
    handle.onMove!(ctxAt(350, 20));
    handle.onEnd!(ctxAt(350, 20), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    const edge = commit.mock.calls[0]![0] as PendingEdge;
    expect(edge.from).toEqual({ kind: 'body', nodeId: 'a', point: { x: 50, y: 20 } });
    expect(edge.to).toEqual({ kind: 'body', nodeId: 'b', point: { x: 350, y: 20 } });
  });

  it('starts nothing from a press on open canvas', () => {
    expect(connectorInvoker({ participants: PARTICIPANTS }).start(ctxAt(200, 200))).toEqual({});
  });
});
