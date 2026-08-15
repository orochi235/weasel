// src/tools/integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './defineTool';
import { ActiveToolContextProvider, useActiveToolContext } from '../interactions/actions/activeToolContext';
import { ActionsProvider, useActionsRegistry } from '../interactions/actions/registry';
import { DepRegistryProvider, useDepSource } from '../interactions/actions/depRegistry';
import { useGestureDispatcher } from '../interactions/dispatcher/useGestureDispatcher';
import type { Action } from '../interactions/actions/registry';
import type { Tool } from './types';
import { useRef } from 'react';

function fire(el: Element, type: string, init: PointerEventInit = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, ...init }));
}

/** A tool whose entire surface is one drag binding to an action it owns. */
function dragTool(id: string, key: string, spy: () => void): Tool<null> {
  const action: Action = {
    id: `${id}.drag`,
    label: id,
    invoker: { timing: 'ongoing', start: () => { spy(); return { onMove: () => {}, onEnd: () => {} }; } },
  };
  return defineTool<null>({
    id,
    keybinding: { key },
    actions: [action],
    bindings: [{ spec: { kind: 'drag' }, actionId: `${id}.drag` }],
  });
}

describe('integration: define → use → key → dispatch', () => {
  it('a keybinding switches the active tool, and the drag routes through the new one', () => {
    const selectDrag = vi.fn();
    const penDrag = vi.fn();

    function App() {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const actions = useActionsRegistry();
      const ctx = useActiveToolContext();
      useDepSource('activeTool', () => ctx);

      const select = dragTool('select', 'v', selectDrag);
      const pen = dragTool('pen', 'p', penDrag);
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);

      // Tool-owned actions register here rather than via `useToolActions`,
      // which is `<SceneCanvas>`-specific.
      for (const tool of [select, pen]) {
        for (const a of tool.actions ?? []) actions?.register(a);
      }

      useGestureDispatcher({
        canvasRef,
        actions: actions!,
        toolsById: new Map<string, Tool>([['select', select as Tool], ['pen', pen as Tool]]),
      });
      return <canvas ref={canvasRef} />;
    }

    const { container } = render(
      <DepRegistryProvider>
        <ActionsProvider>
          <ActiveToolContextProvider initialActive="select">
            <App />
          </ActiveToolContextProvider>
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    const canvas = container.querySelector('canvas')!;

    // 1. Drag with select active.
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 });
      fire(canvas, 'pointermove', { clientX: 50, clientY: 10 });
      fire(canvas, 'pointerup', { clientX: 50, clientY: 10 });
    });
    expect(selectDrag).toHaveBeenCalledOnce();
    expect(penDrag).not.toHaveBeenCalled();

    // 2. Press 'p' to switch. `tool.activate` is an Action on the same
    //    dispatcher — the parallel document listener `useKeybindings` used to
    //    install was deleted in the audit follow-up (3.8).
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    });

    // 3. Drag with pen active.
    act(() => {
      fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 });
      fire(canvas, 'pointermove', { clientX: 50, clientY: 10 });
      fire(canvas, 'pointerup', { clientX: 50, clientY: 10 });
    });
    expect(penDrag).toHaveBeenCalledOnce();
    expect(selectDrag).toHaveBeenCalledOnce(); // not called again
  });
});
