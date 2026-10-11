/**
 * A drop's items materialize after the event has left the stack. By then the
 * pointer may be over another view, and the drop still belongs, dispatcher
 * and context both, to the view it landed in.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, type DispatcherContext } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { InputEvent } from './matcher';

/** The panel is every point at client x >= 100. */
const viewAt = (_pointerId: number | null, x: number): { id: string | null } =>
  ({ id: x >= 100 ? 'panel' : null });
const resolver = { at: viewAt, begin: viewAt, end: (): void => {} };

describe('a drop whose items arrive after the pointer changed view', () => {
  it('dispatches with the context of the view it landed in', async () => {
    const root = createDispatcher();
    const panel = createDispatcher();
    const seen: { ev: InputEvent; ctx: DispatcherContext }[] = [];
    vi.spyOn(panel, 'handleInput').mockImplementation((ev, ctx) => {
      seen.push({ ev, ctx });
      return 'unhandled';
    });
    const target: DispatcherViewTarget = {
      id: 'panel', dispatcher: panel,
      affordanceAt: undefined, classifyTarget: undefined, clientToWorld: undefined,
    };
    function Mount(): ReactNode {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const registry = useActionsRegistry();
      useGestureDispatcher({
        canvasRef, actions: registry!, entriesById: new Map(), dispatcher: root,
        views: { targets: () => [target], resolver },
      });
      return <canvas ref={canvasRef} data-testid="c" />;
    }
    render(
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider><Mount /></ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>,
    );
    const canvas = document.querySelector('[data-testid="c"]')!;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(drop, {
      clientX: 150, clientY: 10,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      dataTransfer: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }], files: [file] },
    });
    act(() => {
      canvas.dispatchEvent(drop);
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 50, clientY: 10 }));
    });

    await vi.waitFor(() => { expect(seen.some((s) => s.ev.kind === 'drop')).toBe(true); });
    expect(seen.find((s) => s.ev.kind === 'drop')!.ctx.viewId).toBe('panel');
  });
});
