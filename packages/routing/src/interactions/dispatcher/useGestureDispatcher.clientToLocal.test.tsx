/**
 * The canvas-local point the dispatcher hands the painted cursor, a wheel and
 * a long-press: the element rect alone, or the host's own mapping when it
 * supplies one — a canvas under a CSS transform needs the latter.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { createPaintedCursorState, type PaintedCursorState } from '@weasel-js/cursor';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { useGestureDispatcher } from './useGestureDispatcher';

const PAINTED = { kind: 'painted', glyph: 'crosshairRect', angle: 0, worldRadius: 12 } as const;
const LEFT = 100;
const TOP = 50;

/** Drawn at half size: two client pixels per canvas pixel, from the corner. */
const halfScale = (cx: number, cy: number) => ({ x: (cx - LEFT) / 2, y: (cy - TOP) / 2 });

function Probe({ painted, clientToLocal }: {
  painted: PaintedCursorState;
  clientToLocal?: (cx: number, cy: number) => { x: number; y: number };
}) {
  const registry = useActionsRegistry();
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

function cursorAfterMove(clientToLocal?: (cx: number, cy: number) => { x: number; y: number }) {
  const painted = createPaintedCursorState();
  painted.setBase(PAINTED);
  const { container } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe painted={painted} {...(clientToLocal ? { clientToLocal } : {})} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    left: LEFT, top: TOP, right: LEFT + 400, bottom: TOP + 400, width: 400, height: 400,
    x: LEFT, y: TOP, toJSON: () => ({}),
  });
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: LEFT + 60, clientY: TOP + 40 }));
  });
  return painted.current()?.at;
}

describe('the dispatcher\'s canvas-local point', () => {
  it('is the client point less the element rect by default', () => {
    expect(cursorAfterMove()).toEqual({ x: 60, y: 40 });
  });

  it('comes from the host\'s clientToLocal when it supplies one', () => {
    expect(cursorAfterMove(halfScale)).toEqual({ x: 30, y: 20 });
  });
});
