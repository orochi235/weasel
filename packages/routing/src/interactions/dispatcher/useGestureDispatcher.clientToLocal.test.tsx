/**
 * The canvas-local point the dispatcher hands the painted cursor, a wheel, a
 * long-press and a drag's `screenDelta`: the element rect alone, or the host's own mapping when it
 * supplies one — a canvas under a CSS transform needs the latter.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { createPaintedCursorState, type PaintedCursorState } from '@weasel-js/cursor';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import type { InvocationCtx } from '../actions/invoker';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { useGestureDispatcher } from './useGestureDispatcher';

const PAINTED = { kind: 'painted', glyph: 'crosshairRect', angle: 0, worldRadius: 12 } as const;
const LEFT = 100;
const TOP = 50;

/** Drawn at half size: two client pixels per canvas pixel, from the corner. */
const halfScale = (cx: number, cy: number) => ({ x: (cx - LEFT) / 2, y: (cy - TOP) / 2 });

function Probe({ painted, clientToLocal, action }: {
  painted: PaintedCursorState;
  clientToLocal?: (cx: number, cy: number) => { x: number; y: number };
  action?: Action;
}) {
  const registry = useActionsRegistry();
  if (action) registry?.register(action);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    paintedCursor: () => painted,
    ...(clientToLocal ? { clientToLocal } : {}),
  });
  return <canvas ref={canvasRef} />;
}

function mount(clientToLocal?: (cx: number, cy: number) => { x: number; y: number }, action?: Action) {
  const painted = createPaintedCursorState();
  painted.setBase(PAINTED);
  const { container } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe painted={painted} {...(clientToLocal ? { clientToLocal } : {})} {...(action ? { action } : {})} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    left: LEFT, top: TOP, right: LEFT + 400, bottom: TOP + 400, width: 400, height: 400,
    x: LEFT, y: TOP, toJSON: () => ({}),
  });
  return { canvas, painted };
}

function cursorAfterMove(clientToLocal?: (cx: number, cy: number) => { x: number; y: number }) {
  const { canvas, painted } = mount(clientToLocal);
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: LEFT + 60, clientY: TOP + 40 }));
  });
  return painted.current()?.at;
}

function dragDelta(clientToLocal?: (cx: number, cy: number) => { x: number; y: number }) {
  const onMove = vi.fn((_ctx: InvocationCtx) => {});
  const action: Action = {
    id: 'probe.drag', label: 'drag', defaultBinding: { kind: 'drag' },
    invoker: { timing: 'ongoing', start: () => ({ onMove }) },
  };
  const { canvas } = mount(clientToLocal, action);
  const fire = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
  act(() => {
    fire('pointerdown', LEFT + 20, TOP + 20);
    fire('pointermove', LEFT + 80, TOP + 60);
  });
  return onMove.mock.calls.at(-1)?.[0].drag?.screenDelta;
}

describe('the dispatcher\'s canvas-local point', () => {
  it('is the client point less the element rect by default', () => {
    expect(cursorAfterMove()).toEqual({ x: 60, y: 40 });
  });

  it('comes from the host\'s clientToLocal when it supplies one', () => {
    expect(cursorAfterMove(halfScale)).toEqual({ x: 30, y: 20 });
  });

  it("measures a drag's screenDelta through the host's clientToLocal", () => {
    expect(dragDelta()).toEqual({ x: 60, y: 40 });
    expect(dragDelta(halfScale)).toEqual({ x: 30, y: 20 });
  });
});
