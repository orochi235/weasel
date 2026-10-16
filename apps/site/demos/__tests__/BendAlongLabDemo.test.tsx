import { act, cleanup } from '@testing-library/react';
import type { RectPose } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BendAlongLabDemo } from '../BendAlongLabDemo';
import type { PathEffectProbe } from '../pathEffectLab';

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

/** The bent ribbon's bounds, as the live scene has it. */
const bentBounds = () => window.__weaselTest!.probe<PathEffectProbe>('pathEffects')!.bent![0]!;

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

describe('BendAlongLabDemo', () => {
  it('opens with the spine in path edit, and re-bends the ribbon as a spine anchor is dragged', async () => {
    const { container } = await renderSettled(<StrictMode><BendAlongLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const before = bentBounds();
    // Stretched along the whole spine, end to end.
    expect(before.x).toBeLessThan(90);
    expect(before.x + before.width).toBeGreaterThan(630);

    // The spine's middle anchor, at (420, 260), dragged up and right.
    drag(canvas, [420, 260], [450, 120]);

    const spine = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'spine')!;
    expect((spine.pose as RectPose).y).toBeLessThan(150);
    expect(bentBounds().y).toBeLessThan(before.y - 50);
  });
});
