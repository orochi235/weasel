/**
 * A pen reports its eraser end as button 5 and its barrel button as button 2,
 * where a mouse reports only 0, 1 and 2.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

function mount() {
  const fired: string[] = [];
  const drag: Action = {
    id: 'test.drag', label: 'drag', defaultBinding: { kind: 'drag' },
    invoker: {
      timing: 'ongoing',
      start: () => {
        fired.push('drag');
        return { onEnd: (_ctx, reason) => { fired.push(`drag:${reason}`); } };
      },
    },
  };
  function Mount(): ReactNode {
    const registry = useActionsRegistry();
    const ref = useRef<HTMLCanvasElement | null>(null);
    registry?.register(drag);
    useGestureDispatcher({ canvasRef: ref, actions: registry!, entriesById: new Map() });
    return <canvas ref={ref} data-testid="c" />;
  }
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = document.querySelector('[data-testid="c"]')!;
  const pen = (type: string, button: number, buttons: number, x = 50): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 7, pointerType: 'pen', button, buttons, clientX: x, clientY: 50,
      }));
    });
  };
  return { fired, pen };
}

describe('a pen on a canvas that binds a drag', () => {
  it('drags with its eraser end, which presses as button 5', () => {
    const { fired, pen } = mount();
    pen('pointerdown', 5, 32);
    pen('pointermove', -1, 32, 90);
    pen('pointerup', 5, 0, 90);
    expect(fired).toEqual(['drag', 'drag:commit']);
  });

  it('drags with its tip', () => {
    const { fired, pen } = mount();
    pen('pointerdown', 0, 1);
    pen('pointermove', -1, 1, 90);
    pen('pointerup', 0, 0, 90);
    expect(fired).toEqual(['drag', 'drag:commit']);
  });
});
