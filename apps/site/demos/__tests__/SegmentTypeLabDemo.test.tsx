import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { PATH_C, PATH_L, type Path } from '@weasel-js/core';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SegmentTypeLabDemo } from '../SegmentTypeLabDemo';

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

/** The tab's commands after its M: L, L, C, and a Z for the straight base. */
const commands = () => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'tab')!;
  return Array.from((node.data as { path: Path & { commands: Uint8Array } }).path.commands).slice(1);
};

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function shiftDoubleClick(canvas: Element, x: number, y: number) {
  const at = (type: string) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, shiftKey: true }));
  act(() => {
    for (let i = 0; i < 2; i++) {
      at('pointerdown');
      at('pointerup');
    }
  });
}

describe('SegmentTypeLabDemo', () => {
  it('curves the straight base under a Shift+double-click, and the selected top edge from the bar', async () => {
    const { container } = await renderSettled(<StrictMode><SegmentTypeLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(commands().slice(0, 3)).toEqual([PATH_L, PATH_L, PATH_C]);

    shiftDoubleClick(canvas, 205, 240);
    expect(commands().filter((c) => c === PATH_C)).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Make segments curved' }));
    expect(commands().slice(0, 3)).toEqual([PATH_L, PATH_C, PATH_C]);
  });
});
