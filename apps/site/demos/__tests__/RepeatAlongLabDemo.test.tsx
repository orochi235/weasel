import { act, cleanup } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RepeatAlongLabDemo } from '../RepeatAlongLabDemo';
import type { PathEffectProbe } from '../pathEffectLab';
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

/** Where each copy sits, as the live scene has it. */
const copyCenters = () =>
  window.__weaselTest!.probe<PathEffectProbe>('pathEffects')!.copies!.map((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }));

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

describe('RepeatAlongLabDemo', () => {
  it('opens with copies spread along the track, which follow its end anchor when dragged', async () => {
    const { container } = await renderSettled(<StrictMode><RepeatAlongLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const before = copyCenters();
    expect(before).toHaveLength(9);
    // A copy's box is centered on its station, give or take its turn.
    expect(Math.abs(before[8]!.x - 660)).toBeLessThan(10);

    // The track's last anchor, at (660, 320), dragged down and left.
    drag(canvas, [660, 320], [600, 420]);

    const after = copyCenters();
    expect(after).toHaveLength(9);
    expect(after[0]).toEqual(before[0]);
    expect(Math.abs(after[8]!.x - 600)).toBeLessThan(10);
    expect(Math.abs(after[8]!.y - 420)).toBeLessThan(10);
  });
});
