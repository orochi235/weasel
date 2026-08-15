/**
 * Space-for-hand, end to end. The suite used to stay green with the whole
 * behavior deleted: the offhand key was matched by tool *id* in a host-side
 * table, and the test that covered it built its own `hand` fixture. Nothing
 * tied the real tool to the real key.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from 'interactions/actions/registry';
import { DepRegistryProvider, useDepSource } from 'interactions/actions/depRegistry';
import 'interactions/actions/depSchema';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from 'interactions/actions/activeToolContext';
import { useGestureDispatcher } from 'interactions/dispatcher/useGestureDispatcher';
import { defineTool } from '../../defineTool';
import { useTools } from '../../useTools';
import { useHandTool } from './useHandTool';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function ActiveToolDepSource() {
  const ctx = useActiveToolContext();
  useDepSource('activeTool', () => ctx);
  return null;
}

function Mount({ onCtx }: { onCtx: (v: ActiveToolContextValue) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const registry = useActionsRegistry();
  const hand = useHandTool();
  onCtx(useActiveToolContext());
  const tools = useTools({
    active: 'select',
    registry: { select: defineTool({ id: 'select' }), hand },
  });
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById: new Map(Object.entries(tools.registry)),
  });
  return <canvas ref={canvasRef} />;
}

describe('useHandTool held-key engagement', () => {
  it('engages hand while Space is held and releases it on keyup', () => {
    let ctx!: ActiveToolContextValue;
    render(
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider>
            <ActiveToolDepSource />
            <Mount onCtx={(v) => { ctx = v; }} />
          </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>,
    );

    expect(ctx.hotkeyStack).toEqual([]);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    expect(ctx.hotkeyStack).toEqual(['hand']);
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })); });
    expect(ctx.hotkeyStack).toEqual([]);
  });
});
