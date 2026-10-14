/**
 * Space mid-draw, through the real dispatcher with the real rect and hand
 * tools: it repositions the shape being drawn and never engages the hand.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, useActionsRegistry,
  useActiveToolContext, useDepSource, useGestureDispatcher, type ActiveToolContextValue,
} from '@weasel-js/routing/react';
import '../actions/depSchema';
import { insertAction } from '../actions/insert/action';
import { insertRepositionAction } from '../actions/insert/repositionAction';
import type { InsertDep, InsertLive } from '../actions/depSchema';
import { useTools } from '../../tools/overlayBinding';
import { useRectTool } from '../../tools/builtin/rect';
import { useHandTool } from '../../tools/builtin/hand/useHandTool';
import type { NodeId } from 'core/scene/types';

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

type Bounds = { x: number; y: number; width: number; height: number };

function mount() {
  const committed: Bounds[] = [];
  const insert: InsertDep = { commit: (bounds) => { committed.push({ ...bounds }); return 'n' as NodeId; } };
  const insertLive: InsertLive = { gesture: null };
  let tools!: ActiveToolContextValue;

  function Deps() {
    const ctx = useActiveToolContext();
    tools = ctx;
    useDepSource('activeTool', () => ctx);
    useDepSource('insert', () => insert);
    useDepSource('insertLive', () => insertLive);
    const registry = useActionsRegistry();
    if (registry && !registry.list().some((a) => a.id === 'insert')) {
      registry.register(insertAction);
      registry.register(insertRepositionAction);
    }
    return null;
  }

  function Mount() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    const api = useTools({ active: 'rect', registry: { rect: useRectTool(), hand: useHandTool() } });
    useGestureDispatcher({
      canvasRef,
      actions: registry!,
      entriesById: new Map(Object.entries(api.registry)),
      classifyTarget: () => ({ body: 'empty' }),
    });
    return <canvas ref={canvasRef} data-testid="canvas" />;
  }

  const { getByTestId } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Deps />
          <Mount />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = getByTestId('canvas');
  const pointer = (type: string, x: number, y: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
    });
  };
  const space = (type: 'keydown' | 'keyup'): void => {
    act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space' })); });
  };
  return { committed, pointer, space, hotkeys: () => tools.hotkeyStack };
}

describe('Space while drawing a shape', () => {
  it('moves the shape instead of resizing it, and does not engage the hand', () => {
    const { committed, pointer, space, hotkeys } = mount();
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 60, 40);
    space('keydown');
    expect(hotkeys()).toEqual([]);
    pointer('pointermove', 90, 70);
    space('keyup');
    pointer('pointermove', 100, 90);
    pointer('pointerup', 100, 90);
    expect(hotkeys()).toEqual([]);
    expect(committed).toEqual([{ x: 40, y: 40, width: 60, height: 50 }]);
  });

  it('still engages the hand between drags', () => {
    const { pointer, space, hotkeys } = mount();
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 60, 40);
    pointer('pointerup', 60, 40);
    space('keydown');
    expect(hotkeys()).toEqual(['hand']);
    space('keyup');
    expect(hotkeys()).toEqual([]);
  });
});
