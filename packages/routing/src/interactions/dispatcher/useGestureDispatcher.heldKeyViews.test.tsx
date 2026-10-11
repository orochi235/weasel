/**
 * A held key is released on the dispatcher that took its keydown. Each view
 * has a dispatcher of its own, and the pointer may be over another view by
 * the time the key comes up.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher, type DispatcherViewTarget } from './useGestureDispatcher';
import { createDispatcher, type Dispatcher } from './dispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';

/** The panel is every point at client x >= 100. */
const viewAt = (_pointerId: number | null, x: number): { id: string | null } =>
  ({ id: x >= 100 ? 'panel' : null });
const resolver = { at: viewAt, begin: viewAt, end: (): void => {} };

function mount(): { root: Dispatcher; panel: Dispatcher; log: string[]; canvas: Element } {
  const log: string[] = [];
  const hold: Action = {
    id: 'test.hold', label: 'hold', defaultBinding: { kind: 'key-held', key: 'h' },
    invoker: {
      timing: 'ongoing',
      start: () => { log.push('start'); return { onEnd: () => { log.push('end'); } }; },
    },
  };
  const root = createDispatcher();
  const panel = createDispatcher();
  const target: DispatcherViewTarget = {
    id: 'panel', dispatcher: panel,
    affordanceAt: undefined, classifyTarget: undefined, clientToWorld: undefined,
  };
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useAction(hold);
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
  return { root, panel, log, canvas: document.querySelector('[data-testid="c"]')! };
}

const hover = (canvas: Element, x: number): void => {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: x, clientY: 10 }));
  });
};
const key = (type: 'keydown' | 'keyup'): void => {
  act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: 'h', code: 'KeyH' })); });
};

describe('a key held over one view and released over another', () => {
  it('ends on the view that took the keydown', () => {
    const { root, panel, log, canvas } = mount();
    hover(canvas, 150);
    key('keydown');
    expect(panel.inFlight().size).toBe(1);

    hover(canvas, 50);
    key('keyup');

    expect(log).toEqual(['start', 'end']);
    expect(panel.inFlight().size).toBe(0);
    expect(root.inFlight().size).toBe(0);
  });

  it('ends there when the window loses focus', () => {
    const { panel, log, canvas } = mount();
    hover(canvas, 150);
    key('keydown');
    hover(canvas, 50);

    act(() => { window.dispatchEvent(new Event('blur')); });

    expect(log).toEqual(['start', 'end']);
    expect(panel.inFlight().size).toBe(0);
  });
});
