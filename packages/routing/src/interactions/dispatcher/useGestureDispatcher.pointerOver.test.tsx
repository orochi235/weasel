/** Whether the pointer is over a surface: per pointer, and not while it is over a surface nested inside. */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import type { DispatcherChannels } from './gestureDispatcherOptions';
import { heldKeySpec } from '../actions/toolOffhand';

const NO_ENTRIES = new Map();

function Root({ children }: { children: ReactNode }): ReactNode {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

/** A dispatcher on `surface` that peeks while Alt is held over it, and hears hovers with a cursor. */
function Surface({ surface, peeking = () => {}, hovered = () => {}, channels }: {
  surface: RefObject<HTMLElement | null>;
  peeking?: (on: boolean) => void;
  hovered?: () => void;
  channels?: DispatcherChannels;
}): null {
  const registry = useActionsRegistry()!;
  useEffect(() => {
    const offs = [
      registry.register({
        id: 'test.peek', label: 'Peek',
        defaultBinding: [{ spec: heldKeySpec('Alt'), opts: { over: true } }],
        invoker: { timing: 'ongoing', start: () => { peeking(true); return { onEnd: () => peeking(false) }; } },
      } satisfies Action),
      registry.register({
        id: 'test.hover', label: 'Hover', defaultBinding: { kind: 'hover' }, cursor: 'crosshair',
        invoker: { timing: 'immediate', run: () => hovered() },
      } satisfies Action),
      registry.register({
        id: 'test.drag', label: 'Drag', defaultBinding: { kind: 'drag' }, cursor: 'grab',
        invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) },
      } satisfies Action),
    ];
    return () => { for (const off of offs) off?.(); };
  }, [registry, peeking, hovered]);
  useGestureDispatcher({ canvasRef: surface, actions: registry, entriesById: NO_ENTRIES, classifyTarget: () => ({ bodyTarget: 'empty' }), ...(channels ? { channels } : {}) });
  return null;
}

const alt = (type: 'keydown' | 'keyup'): void => {
  act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: 'Alt', code: 'AltLeft', altKey: type === 'keydown', cancelable: true })); });
};
const pointer = (el: Element, type: string, pointerId: number, bubbles = type === 'pointermove'): void => {
  act(() => { el.dispatchEvent(new PointerEvent(type, { pointerId, bubbles, clientX: 5, clientY: 5 })); });
};

describe('one pointer leaving a canvas', () => {
  it('leaves an over binding engaged while another pointer is still over it', () => {
    const peeking = vi.fn();
    function One(): ReactNode {
      const ref = useRef<HTMLCanvasElement | null>(null);
      return <><Surface surface={ref} peeking={peeking} /><canvas ref={ref} /></>;
    }
    render(<Root><One /></Root>);
    const canvas = document.querySelector('canvas')!;
    pointer(canvas, 'pointerenter', 1);
    alt('keydown');
    expect(peeking.mock.calls).toEqual([[true]]);
    pointer(canvas, 'pointerenter', 2);
    pointer(canvas, 'pointerleave', 2);
    expect(peeking.mock.calls).toEqual([[true]]);
    pointer(canvas, 'pointerleave', 1);
    expect(peeking.mock.calls).toEqual([[true], [false]]);
  });
});

describe.each([
  ['the pointer channel', undefined],
  ['the hover channel alone', { pointer: false, hover: true } satisfies DispatcherChannels],
])('a pointer over a surface nested in another, with %s', (_name, channels) => {
  function Nested({ outerPeek, outerHover }: { outerPeek: (on: boolean) => void; outerHover: () => void }): ReactNode {
    const outerRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLCanvasElement | null>(null);
    return (
      <div ref={outerRef}>
        <Surface surface={outerRef} peeking={outerPeek} hovered={outerHover} {...(channels ? { channels } : {})} />
        <Root>
          <Surface surface={innerRef} />
          <canvas ref={innerRef} />
        </Root>
      </div>
    );
  }

  it('is not over the outer surface, which hears no hover and shows no cursor', () => {
    const peek = vi.fn();
    const hovered = vi.fn();
    const { container } = render(<Root><Nested outerPeek={peek} outerHover={hovered} /></Root>);
    const outer = container.firstElementChild as HTMLElement;
    const inner = document.querySelector('canvas')!;
    pointer(inner, 'pointermove', 1);
    alt('keydown');
    expect(hovered).not.toHaveBeenCalled();
    expect(peek).not.toHaveBeenCalled();
    expect(outer.style.cursor).toBe('');
  });

  it('releases the outer surface once the pointer moves on from it into the nested one', () => {
    const peek = vi.fn();
    const hovered = vi.fn();
    const { container } = render(<Root><Nested outerPeek={peek} outerHover={hovered} /></Root>);
    const outer = container.firstElementChild as HTMLElement;
    const inner = document.querySelector('canvas')!;
    pointer(outer, 'pointermove', 1);
    expect(outer.style.cursor).toBe('grab');
    pointer(inner, 'pointermove', 1);
    expect(outer.style.cursor).toBe('');
    pointer(outer, 'pointermove', 1);
    alt('keydown');
    expect(peek.mock.calls).toEqual([[true]]);
    pointer(inner, 'pointermove', 1);
    expect(peek.mock.calls).toEqual([[true], [false]]);
  });
});
