/**
 * Integration tests for long-press synthesis via the gesture dispatcher.
 *
 * Proves:
 *   - A held touch/pen press fires `longPress` after LONG_PRESS_MS
 *   - Mouse never fires it; movement, release, and a second finger cancel it
 *   - An unbound long-press falls back to `contextmenu`; a bound one does not
 *
 * ## Provider tree
 *
 *   DepRegistryProvider > ActiveToolContextProvider > ActionsProvider > Mount
 *
 * Bindings come from each action's `defaultBinding` (ambient scope) rather
 * than from a tool, which is the smallest wiring that exercises the matcher.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry, type Action } from '../actions/registry';
import { DepRegistryProvider } from '../actions/depRegistry';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

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

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const fired: string[] = [];

type Kind = 'longPress' | 'contextMenu';

function markerAction(kind: Kind): Action {
  return {
    id: `test.${kind}`,
    label: kind,
    defaultBinding: { kind },
    invoker: { timing: 'immediate', run: () => { fired.push(`test.${kind}`); } },
  };
}

function mount(kinds: Kind[]): HTMLElement {
  function Mount() {
    const registry = useActionsRegistry();
    const ref = useRef<HTMLCanvasElement | null>(null);
    for (const k of kinds) registry?.register(markerAction(k));
    useGestureDispatcher({
      canvasRef: ref,
      actions: registry!,
      toolsById: new Map(),
      classifyTarget: () => ({ body: 'empty' as const }),
    });
    return <canvas ref={ref} data-testid="canvas" />;
  }
  const { getByTestId } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Mount />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return getByTestId('canvas');
}

function down(canvas: HTMLElement, opts: Partial<PointerEventInit> = {}) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 1, pointerType: 'touch', button: 0, buttons: 1,
      clientX: 50, clientY: 50, bubbles: true, ...opts,
    }));
  });
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

describe('long-press synthesis', () => {
  beforeEach(() => { fired.length = 0; });

  it('fires longPress after 500ms for a touch pointer', () => {
    const c = mount(['longPress']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });

  it('fires for a pen pointer', () => {
    const c = mount(['longPress']);
    down(c, { pointerType: 'pen' });
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });

  it('does not fire for a mouse pointer', () => {
    const c = mount(['longPress']);
    down(c, { pointerType: 'mouse' });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('does not fire before the threshold elapses', () => {
    const c = mount(['longPress']);
    down(c);
    advance(499);
    expect(fired).toEqual([]);
  });

  it('cancels when the pointer moves past the drag threshold', () => {
    const c = mount(['longPress']);
    down(c);
    act(() => {
      c.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 1, pointerType: 'touch', buttons: 1,
        clientX: 70, clientY: 50, bubbles: true,
      }));
    });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('cancels on pointerup before the threshold', () => {
    const c = mount(['longPress']);
    down(c);
    advance(200);
    act(() => {
      c.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true,
      }));
    });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('cancels when a second pointer lands, so it never fires mid-pinch', () => {
    const c = mount(['longPress']);
    down(c);
    down(c, { pointerId: 2, clientX: 120, clientY: 120 });
    advance(500);
    expect(fired).toEqual([]);
  });

  it('falls back to contextmenu when no longPress binding matched', () => {
    const c = mount(['contextMenu']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.contextMenu']);
  });

  it('does not fall back when a longPress binding did match', () => {
    const c = mount(['longPress', 'contextMenu']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });
});
