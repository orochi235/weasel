/**
 * The hover-cursor pump and the painted tier: a cursor the layer draws has to
 * survive a gesture, and has to get out of the way of a CSS cursor.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { createPaintedCursorState, type PaintedCursorState } from '@weasel-js/cursor';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import type { Action } from '../actions/action';
import type { AffordanceHit } from '../actions/invoker';
import { useGestureDispatcher } from './useGestureDispatcher';

const RING = { glyph: 'crosshairRect', worldRadius: 12 } as const;
const PAINTED_RING = { kind: 'painted', glyph: 'crosshairRect', angle: 0, worldRadius: 12 };

function Probe({ action, painted, affordanceAt }: {
  action: Action;
  painted: PaintedCursorState;
  affordanceAt?: () => AffordanceHit | null;
}) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry?.register(action);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    classifyTarget: () => ({ body: 'empty' }),
    paintedCursor: () => painted,
    ...(affordanceAt ? { affordanceAt } : {}),
  });
  return <canvas ref={canvasRef} />;
}

function mount(action: Action, affordanceAt?: () => AffordanceHit | null) {
  const painted = createPaintedCursorState();
  const { container } = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe action={action} painted={painted} {...(affordanceAt ? { affordanceAt } : {})} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  const fire = (type: string, init: PointerEventInit = {}): void => {
    act(() => { canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init })); });
  };
  return { painted, canvas, fire };
}

const brush = (extra: Partial<Action>): Action => ({
  id: 'brush',
  label: 'brush',
  defaultBinding: { kind: 'drag' },
  invoker: { timing: 'ongoing', start: () => ({ onMove: () => {}, onEnd: () => {} }) },
  ...extra,
});

describe('hover-cursor pump, painted tier', () => {
  it('keeps painting an in-flight action whose activeCursor is a painted glyph', () => {
    const { painted, canvas, fire } = mount(brush({ activeCursor: RING }));
    fire('pointermove', { clientX: 5, clientY: 5 });
    fire('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 });
    fire('pointermove', { clientX: 40, clientY: 40, pointerId: 1 });
    expect(canvas.style.cursor).toBe('none');
    expect(painted.current()?.cursor).toEqual(PAINTED_RING);
  });

  it('stops painting the base cursor while a CSS hover cursor shows', () => {
    let overHandle = false;
    const { painted, canvas, fire } = mount(
      brush({}),
      () => (overHandle ? { kind: 'handle:min-min', cursor: 'nwse-resize' } : null),
    );
    painted.setBase(PAINTED_RING as never);
    fire('pointermove', { clientX: 5, clientY: 5 });
    expect(painted.current()?.cursor).toEqual(PAINTED_RING);

    overHandle = true;
    fire('pointermove', { clientX: 6, clientY: 6 });
    expect(canvas.style.cursor).toBe('nwse-resize');
    expect(painted.current()).toBeNull();

    overHandle = false;
    fire('pointermove', { clientX: 7, clientY: 7 });
    expect(painted.current()?.cursor).toEqual(PAINTED_RING);
  });
});
