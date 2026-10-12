/**
 * A browser that sends its own `contextmenu` on a touch hold (Android Chrome)
 * and the dispatcher's synthesized long-press are one hold, and fire once.
 * jsdom sends no such event, so each test dispatches it by hand.
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

function mount(kinds: Kind[]) {
  const fired: string[] = [];
  const marker = (kind: Kind): Action => ({
    id: `test.${kind}`, label: kind, defaultBinding: { kind },
    invoker: { timing: 'immediate', run: () => { fired.push(kind); } },
  });
  function Mount(): ReactNode {
    const registry = useActionsRegistry();
    const ref = useRef<HTMLCanvasElement | null>(null);
    for (const k of kinds) registry?.register(marker(k));
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
  const pointer = (type: string, pointerType = 'touch'): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 1, pointerType, button: 0,
        buttons: type === 'pointerup' ? 0 : 1, clientX: 50, clientY: 50,
      }));
    });
  };
  const nativeMenu = (): MouseEvent => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 });
    act(() => { canvas.dispatchEvent(e); });
    return e;
  };
  return { fired, pointer, nativeMenu };
}

const wait = (ms: number): void => { act(() => { vi.advanceTimersByTime(ms); }); };

describe('a native contextmenu during a touch hold', () => {
  it('is dropped when the long-press already ran the menu', () => {
    const { fired, pointer, nativeMenu } = mount(['contextMenu']);
    pointer('pointerdown');
    wait(500);
    const e = nativeMenu();
    expect(fired).toEqual(['contextMenu']);
    expect(e.defaultPrevented).toBe(true);
  });

  it('fires the pending long-press when it arrives first, and the timer adds nothing', () => {
    const { fired, pointer, nativeMenu } = mount(['contextMenu']);
    pointer('pointerdown');
    wait(400);
    nativeMenu();
    wait(200);
    expect(fired).toEqual(['contextMenu']);
  });

  it('arriving first runs a longPress binding ahead of the menu', () => {
    const { fired, pointer, nativeMenu } = mount(['longPress', 'contextMenu']);
    pointer('pointerdown');
    wait(400);
    nativeMenu();
    expect(fired).toEqual(['longPress']);
  });

  it('spends the press, so its release does not click', () => {
    const { fired, pointer, nativeMenu } = mount(['contextMenu', 'click']);
    pointer('pointerdown');
    wait(400);
    nativeMenu();
    pointer('pointerup');
    expect(fired).toEqual(['contextMenu']);
  });
});

describe('a native contextmenu with no touch held', () => {
  it('runs the menu for a right-click', () => {
    const { fired, nativeMenu } = mount(['contextMenu']);
    nativeMenu();
    expect(fired).toEqual(['contextMenu']);
  });

  it('runs the menu once a held touch has lifted', () => {
    const { fired, pointer, nativeMenu } = mount(['contextMenu']);
    pointer('pointerdown');
    pointer('pointerup');
    nativeMenu();
    expect(fired).toEqual(['contextMenu']);
  });
});
