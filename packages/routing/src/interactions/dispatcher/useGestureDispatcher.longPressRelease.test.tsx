/**
 * A press that became a long-press is spent: its release is not also a click,
 * and moving it afterwards does not open a drag.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

type Kind = 'longPress' | 'contextMenu' | 'click';

function mount(kinds: Kind[]): { fired: string[]; fire: (type: string, x: number) => void } {
  const fired: string[] = [];
  const marker = (kind: Kind): Action => ({
    id: `test.${kind}`, label: kind, defaultBinding: { kind },
    invoker: { timing: 'immediate', run: () => { fired.push(kind); } },
  });
  const drag: Action = {
    id: 'test.drag', label: 'drag', defaultBinding: { kind: 'drag' },
    invoker: { timing: 'ongoing', start: () => { fired.push('drag'); return { onEnd: () => {} }; } },
  };
  function Mount(): ReactNode {
    const registry = useActionsRegistry();
    const ref = useRef<HTMLCanvasElement | null>(null);
    for (const k of kinds) registry?.register(marker(k));
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
  const fire = (type: string, x: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 1, pointerType: 'touch', button: 0,
        buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: 50,
      }));
    });
  };
  return { fired, fire };
}

const hold = (): void => { act(() => { vi.advanceTimersByTime(500); }); };

describe('releasing a press after its long-press fired', () => {
  it('does not also click', () => {
    const { fired, fire } = mount(['longPress', 'click']);
    fire('pointerdown', 50);
    hold();
    fire('pointerup', 50);
    expect(fired).toEqual(['longPress']);
  });

  it('does not click after the contextmenu fallback either', () => {
    const { fired, fire } = mount(['contextMenu', 'click']);
    fire('pointerdown', 50);
    hold();
    fire('pointerup', 50);
    expect(fired).toEqual(['contextMenu']);
  });

  it('does not open a drag when the finger moves before lifting', () => {
    const { fired, fire } = mount(['longPress', 'click']);
    fire('pointerdown', 50);
    hold();
    fire('pointermove', 120);
    fire('pointerup', 120);
    expect(fired).toEqual(['longPress']);
  });

  it('still clicks when the hold fired nothing', () => {
    const { fired, fire } = mount(['click']);
    fire('pointerdown', 50);
    hold();
    fire('pointerup', 50);
    expect(fired).toEqual(['click']);
  });
});
