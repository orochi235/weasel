/**
 * Space-for-hand, end to end. The suite used to stay green with the whole
 * behavior deleted: the offhand key was matched by tool *id* in a host-side
 * table, and the test that covered it built its own `hand` fixture. Nothing
 * tied the real tool to the real key.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
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
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';

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

describe('the hand under a held modifier', () => {
  it('pans on a Shift- or Alt-drag over a selected node rather than moving or cloning it', () => {
    for (const mods of [{ shiftKey: true }, { altKey: true }]) {
      const scene = createScene<{ kind: string }, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });
      let id!: string;
      scene.batch('seed', () => {
        id = scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 200, height: 200 } });
      });
      scene.setSelection([id as never]);
      const start: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
      let last = start;
      const { container, unmount } = render(
        <SceneCanvas features={['draw']} scene={scene} layers={{}} width={200} height={200}
          view={start} onViewChange={(v) => { last = v; }}
          defaultTools={['select', 'hand']} defaultActiveTool="hand" />,
      );
      const canvas = container.querySelector('canvas')!;
      const fire = (type: string, x: number, y: number) =>
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, ...mods }));
      act(() => {
        fire('pointerdown', 50, 50);
        fire('pointermove', 65, 60);
        fire('pointermove', 80, 70);
        fire('pointerup', 80, 70);
      });
      expect([last.x, last.y]).toEqual([-30, -20]);
      expect([...scene.renderOrder()]).toHaveLength(1);
      expect(scene.get(id as never)?.pose).toEqual({ x: 0, y: 0, width: 200, height: 200 });
      unmount();
    }
  });
});
