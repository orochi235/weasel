/**
 * Switching the active tool ends what the outgoing tool had in flight before
 * the incoming one hears it is live, so a new tool never inherits a gesture.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import {
  ActiveToolContextProvider, useActiveToolContext, type ActiveToolContextValue,
} from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import type { Tool } from '../../tools/types';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

function mount(opts: { enabled?: boolean } = {}) {
  const log: string[] = [];
  const redraw = vi.fn();
  const tool = (id: string): Tool<unknown> => ({
    id,
    eligibility: { focus: true },
    onActivate: () => { log.push(`activate:${id}`); },
    onDeactivate: () => { log.push(`deactivate:${id}`); },
  });
  const drags: Contribution = {
    id: 'drags', eligibility: { always: true }, bindings: [{ spec: { kind: 'drag' }, actionId: 'drag' }],
  };
  const entries = new Map<string, Contribution<unknown>>([['a', tool('a')], ['b', tool('b')], [drags.id, drags]]);
  const drag: Action = {
    id: 'drag', label: 'drag',
    invoker: {
      timing: 'ongoing',
      start: () => ({ kind: 'drag', onMove: () => {}, onEnd: (_ctx, reason) => { log.push(`end:${reason}`); } }),
    },
  };
  const held: Action = {
    id: 'held', label: 'held',
    defaultBinding: { kind: 'key-held', key: ' ' },
    invoker: {
      timing: 'ongoing',
      start: () => { log.push('start:held'); return { onEnd: (_ctx, reason) => { log.push(`end:held:${reason}`); } }; },
    },
  };
  let ctx!: ActiveToolContextValue;
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    ctx = useActiveToolContext();
    useAction(drag);
    useAction(held);
    useGestureDispatcher({
      canvasRef, actions: registry!, entriesById: entries, requestRedraw: redraw,
      ...(opts.enabled === undefined ? {} : { enabled: opts.enabled }),
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
  const startDrag = (): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 40, clientY: 0 }));
    });
  };
  return { log, redraw, tools: () => ctx, startDrag };
}

describe('switching the active tool mid-gesture', () => {
  it('deactivates the outgoing tool, cancels the gesture, then activates the incoming one', () => {
    const { log, tools, startDrag } = mount();
    act(() => { tools().setActive('a'); });
    startDrag();
    log.length = 0;
    act(() => { tools().setActive('b'); });
    expect(log).toEqual(['deactivate:a', 'end:cancel', 'activate:b']);
  });

  it('cancels an action a held key has in flight', () => {
    const { log, tools } = mount();
    act(() => { tools().setActive('a'); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    expect(log).toContain('start:held');
    log.length = 0;
    act(() => { tools().setActive('b'); });
    expect(log).toEqual(['deactivate:a', 'end:held:cancel', 'activate:b']);
  });

  it('asks for a redraw, so the canceled gesture\'s overlay does not stay painted', () => {
    const { redraw, tools, startDrag } = mount();
    act(() => { tools().setActive('a'); });
    startDrag();
    redraw.mockClear();
    act(() => { tools().setActive('b'); });
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it('asks for no redraw when nothing was in flight', () => {
    const { redraw, tools } = mount();
    act(() => { tools().setActive('a'); });
    act(() => { tools().setActive('b'); });
    expect(redraw).not.toHaveBeenCalled();
  });

  it('runs the lifecycle hooks for a dispatcher that is not enabled', () => {
    const { log, tools } = mount({ enabled: false });
    act(() => { tools().setActive('a'); });
    act(() => { tools().setActive('b'); });
    expect(log).toEqual(['activate:a', 'deactivate:a', 'activate:b']);
  });
});
