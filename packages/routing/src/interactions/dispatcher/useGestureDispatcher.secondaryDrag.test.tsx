/**
 * A secondary press the canvas can drag owns its native `contextmenu`, which a
 * browser sends while the press is held (macOS, Linux) or just after its
 * release (Windows). jsdom sends none, so each test dispatches it by hand.
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

function mount({ drags }: { drags: boolean }) {
  const fired: string[] = [];
  const menu: Action = {
    id: 'test.menu', label: 'menu', defaultBinding: { kind: 'contextMenu' },
    invoker: { timing: 'immediate', run: () => { fired.push('menu'); } },
  };
  const drag: Action = {
    id: 'test.drag', label: 'drag', defaultBinding: { kind: 'drag', button: 'secondary' },
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
    registry?.register(menu);
    if (drags) registry?.register(drag);
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
  const pointer = (type: string, x = 50): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 1, pointerType: 'mouse', button: type === 'pointermove' ? -1 : 2,
        buttons: type === 'pointerup' ? 0 : 2, clientX: x, clientY: 50,
      }));
    });
  };
  const nativeMenu = (x = 50): MouseEvent => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: 50 });
    act(() => { canvas.dispatchEvent(e); });
    return e;
  };
  return { fired, pointer, nativeMenu };
}

describe('a secondary press on a canvas that binds a secondary drag', () => {
  it('drags, and its menu, sent while held, opens nothing', () => {
    const { fired, pointer, nativeMenu } = mount({ drags: true });
    pointer('pointerdown');
    const e = nativeMenu();
    pointer('pointermove', 90);
    pointer('pointerup', 90);
    expect(fired).toEqual(['drag', 'drag:commit']);
    expect(e.defaultPrevented).toBe(true);
  });

  it('drags, and its menu, sent after the release, opens nothing', () => {
    const { fired, pointer, nativeMenu } = mount({ drags: true });
    pointer('pointerdown');
    pointer('pointermove', 90);
    pointer('pointerup', 90);
    nativeMenu(90);
    expect(fired).toEqual(['drag', 'drag:commit']);
  });

  it('released in place opens the menu once, on the release, whenever its native menu comes', () => {
    const held = mount({ drags: true });
    held.pointer('pointerdown');
    held.nativeMenu();
    expect(held.fired).toEqual([]);
    held.pointer('pointerup');
    expect(held.fired).toEqual(['menu']);

    const after = mount({ drags: true });
    after.pointer('pointerdown');
    after.pointer('pointerup');
    after.nativeMenu();
    expect(after.fired).toEqual(['menu']);
  });

  it('leaves a later menu somewhere else, from the keyboard say, to open', () => {
    const { fired, pointer, nativeMenu } = mount({ drags: true });
    pointer('pointerdown');
    pointer('pointerup');
    nativeMenu(5);
    expect(fired).toEqual(['menu', 'menu']);
  });
});

describe('a secondary press on a canvas that binds no secondary drag', () => {
  it('is left to the native menu, as before', () => {
    const { fired, pointer, nativeMenu } = mount({ drags: false });
    pointer('pointerdown');
    nativeMenu();
    pointer('pointerup');
    expect(fired).toEqual(['menu']);
  });
});
