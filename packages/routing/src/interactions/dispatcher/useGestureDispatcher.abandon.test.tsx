/**
 * The dispatcher's listeners read its options through refs. A render React
 * throws away must not leave its options there for the next event.
 */
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

type Opts = {
  onDoubleClick: (p: { x: number; y: number }) => void;
  clientToWorld: (x: number, y: number) => { x: number; y: number };
};

function Mount({ opts }: { opts: Opts }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actions = useActionsRegistry();
  useGestureDispatcher({ canvasRef, actions: actions!, entriesById: new Map(), ...opts });
  return <canvas ref={canvasRef} data-testid="c" />;
}

function click(canvas: Element, x: number, y: number): void {
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}

describe('useGestureDispatcher after an abandoned render', () => {
  it('routes events through the committed options', () => {
    const committed: Opts = { onDoubleClick: vi.fn(), clientToWorld: (x, y) => ({ x, y }) };
    const abandoned: Opts = { onDoubleClick: vi.fn(), clientToWorld: (x, y) => ({ x: x + 1000, y }) };
    renderThenAbandon(committed, abandoned, (opts) => (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider><Mount opts={opts} /></ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    ));
    const canvas = document.querySelector('[data-testid="c"]')!;
    act(() => { click(canvas, 10, 20); click(canvas, 10, 20); });
    expect(abandoned.onDoubleClick).not.toHaveBeenCalled();
    expect(committed.onDoubleClick).toHaveBeenCalledWith({ x: 10, y: 20 });
  });
});
