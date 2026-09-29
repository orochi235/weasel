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
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';
import { DepRegistryProvider } from '@weasel-js/routing/react';
import '../actions/depSchema';
import { ActiveToolContextProvider } from '@weasel-js/routing/react';
import { useGestureDispatcher } from '@weasel-js/routing/react';
import { createLongPressStore, type LongPressStore } from '@weasel-js/routing';

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

function mount(
  kinds: Kind[],
  opts: { state?: LongPressStore; haptics?: boolean; duration?: number } = {},
): HTMLElement {
  function Mount() {
    const registry = useActionsRegistry();
    const ref = useRef<HTMLCanvasElement | null>(null);
    for (const k of kinds) registry?.register(markerAction(k));
    useGestureDispatcher({
      canvasRef: ref,
      actions: registry!,
      entriesById: new Map(),
      classifyTarget: () => ({ body: 'empty' as const }),
      longPress: opts,
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

function pointer(canvas: HTMLElement, type: string, opts: Partial<PointerEventInit> = {}) {
  act(() => {
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'touch', buttons: 1,
      clientX: 50, clientY: 50, bubbles: true, ...opts,
    }));
  });
}

describe('pending long-press state', () => {
  beforeEach(() => { fired.length = 0; });

  it('publishes the held press, armed, and its progress through the hold', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c, { clientX: 60, clientY: 70 });
    const p = store.get();
    expect(p).toMatchObject({
      pointerId: 1, pointerType: 'touch', client: { x: 60, y: 70 },
      viewId: null, duration: 500, armed: true,
    });
    expect(store.progress(p!.startedAt + 250)).toBeCloseTo(0.5);
    advance(250);
    expect(store.progress()).toBeCloseTo(0.5);
  });

  it('times the hold by the duration it is given', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store, duration: 800 });
    down(c);
    expect(store.get()?.duration).toBe(800);
    advance(500);
    expect(fired).toEqual([]);
    expect(store.progress()).toBeCloseTo(0.625);
    advance(300);
    expect(fired).toEqual(['test.longPress']);
  });

  it('clears when the long-press fires', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
    expect(store.get()).toBeNull();
  });

  it('is not armed when nothing is bound — the press would do nothing', () => {
    const store = createLongPressStore();
    const c = mount([], { state: store });
    down(c);
    expect(store.get()?.armed).toBe(false);
  });

  it('is armed by a contextMenu binding, which the fallback reaches', () => {
    const store = createLongPressStore();
    const c = mount(['contextMenu'], { state: store });
    down(c);
    expect(store.get()?.armed).toBe(true);
  });

  it('never publishes a mouse press', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c, { pointerType: 'mouse' });
    expect(store.get()).toBeNull();
  });

  it('clears when the pointer moves past the drag threshold', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c);
    pointer(c, 'pointermove', { clientX: 52, clientY: 50 });
    expect(store.get()).not.toBeNull();
    pointer(c, 'pointermove', { clientX: 70, clientY: 50 });
    expect(store.get()).toBeNull();
  });

  it('clears on release', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c);
    advance(200);
    pointer(c, 'pointerup', { buttons: 0 });
    expect(store.get()).toBeNull();
  });

  it('clears on pointercancel', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c);
    pointer(c, 'pointercancel', { buttons: 0 });
    expect(store.get()).toBeNull();
  });

  it('clears when a second pointer lands', () => {
    const store = createLongPressStore();
    const c = mount(['longPress'], { state: store });
    down(c);
    down(c, { pointerId: 2, clientX: 120, clientY: 120 });
    expect(store.get()).toBeNull();
  });
});

describe('long-press haptics', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fired.length = 0;
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
  });
  afterEach(() => {
    delete (navigator as { vibrate?: unknown }).vibrate;
  });

  it('vibrates once when a bound long-press fires', () => {
    const c = mount(['longPress']);
    down(c);
    advance(499);
    expect(vibrate).not.toHaveBeenCalled();
    advance(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('does not vibrate when nothing handled the long-press', () => {
    const c = mount([]);
    down(c);
    advance(500);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not vibrate when haptics are turned off', () => {
    const c = mount(['longPress'], { haptics: false });
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('fires without error where the Vibration API is absent', () => {
    delete (navigator as { vibrate?: unknown }).vibrate;
    const c = mount(['longPress']);
    down(c);
    advance(500);
    expect(fired).toEqual(['test.longPress']);
  });
});
