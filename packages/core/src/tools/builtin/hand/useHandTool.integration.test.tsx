/**
 * Space-for-hand, end to end. The suite used to stay green with the whole
 * behavior deleted: the offhand key was matched by tool *id* in a host-side
 * table, and the test that covered it built its own `hand` fixture. Nothing
 * tied the real tool to the real key.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import { DepRegistryProvider, useDepSource } from '@weasel-js/routing/react';
import 'interactions/actions/depSchema';
import { ActiveToolContextProvider, useActiveToolContext, type ActiveToolContextValue } from '@weasel-js/routing/react';
import { useGestureDispatcher } from '@weasel-js/routing/react';
import { defineTool } from '../../overlayBinding';
import { useTools } from '../../overlayBinding';
import { useHandTool } from './useHandTool';
import type { ToolsApi } from '../../overlayBinding';
import { SceneCanvas } from '../../../canvas/SceneCanvas';
import { useScene } from 'core/scene/useScene';

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
    entriesById: new Map(Object.entries(tools.registry)),
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

describe('useHandTool held-key engagement in a bare <SceneCanvas>', () => {
  // SceneCanvas assembles its tools above the actions provider it mounts, so
  // with no provider of the consumer's own, nothing registered `tool.offhand`.
  it('engages hand while Space is held', () => {
    let tools: ToolsApi | null = null;
    function Harness() {
      const scene = useScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({
        systemLayers: [{ id: 'main' }], initial: [],
      });
      return (
        <SceneCanvas
          scene={scene}
          width={100} height={100}
          layers={{}}
          viewport={{ pinchZoom: true }}
          onToolsCreated={(t) => { tools = t; }}
        />
      );
    }
    render(<Harness />);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    expect(tools!.hotkeyEngaged).toBe('hand');
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })); });
    expect(tools!.hotkeyEngaged).toBe(null);
  });
});
