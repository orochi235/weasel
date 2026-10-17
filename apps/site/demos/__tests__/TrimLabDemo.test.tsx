import { StrictMode } from 'react';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { pathInWorld, type Path } from '@weasel-js/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TrimLabDemo } from '../TrimLabDemo';
import { withIcons } from '../../testIcons';

// windease lays a lab's tiles out only once something measures them, and
// jsdom ships no ResizeObserver.
beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      this.#cb([{ target, contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const worldCoords = (id: string) => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!;
  const p = pathInWorld((node.data as { path: Path }).path, node.pose as never) as { coords: ArrayLike<number> };
  return Array.from(p.coords).map((v) => Math.round(v * 1000) / 1000);
};

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function click(canvas: Element, x: number, y: number) {
  const at = (type: string) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  act(() => {
    at('pointerdown');
    at('pointerup');
  });
}

describe('TrimLabDemo', () => {
  it('clicking a piece between two crossings cuts it away, and Undo puts it back', async () => {
    const { container } = await renderSettled(<StrictMode><TrimLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const before = worldCoords('top');

    click(canvas, 260, 162);
    expect(worldCoords('top')).toEqual([80, 160, 200, 160, 320, 160, 440, 160]);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(worldCoords('top')).toEqual(before);
  });
});
