import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BlendLabDemo } from '../BlendLabDemo';
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

const nodes = () => window.__weaselTest!.getScene().nodes;

/** Where each step the blend paints sits, as the live scene has it. */
const stepCenters = () =>
  window.__weaselTest!.probe<PathEffectProbe>('pathEffects')!.blend!.map((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }));

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

describe('BlendLabDemo', () => {
  it('opens on a live blend whose steps follow a dragged source', async () => {
    const { container } = await renderSettled(<StrictMode><BlendLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const before = stepCenters();
    expect(before).toHaveLength(5);

    drag(canvas, [490, 180], [490, 300]);

    const after = stepCenters();
    expect(after).toHaveLength(5);
    // The last step sits nearest the moved source, so it moves furthest.
    expect(after[4]!.y - before[4]!.y).toBeGreaterThan(80);
    expect(after[0]!.y - before[0]!.y).toBeLessThan(after[4]!.y - before[4]!.y);
  });

  it('drags both sources when the blend itself is dragged, and the steps go with them', async () => {
    const { container } = await renderSettled(<StrictMode><BlendLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const pose = (id: string) => nodes().find((n) => n.id === id)!.pose as { y: number };
    const [fromY, toY] = [pose('from').y, pose('to').y];
    const middle = stepCenters()[2]!;

    drag(canvas, [middle.x, middle.y], [middle.x, middle.y + 50]);

    expect(pose('from').y).toBeCloseTo(fromY + 50, 3);
    expect(pose('to').y).toBeCloseTo(toY + 50, 3);
    expect(stepCenters()[2]!.y).toBeCloseTo(middle.y + 50, 3);
  });

  it('expands the selected blend into ordinary paths', async () => {
    await renderSettled(<StrictMode><BlendLabDemo /></StrictMode>);
    expect(nodes()).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Expand to Paths' }));
    expect(nodes().find((n) => n.id === 'blend')).toBeUndefined();
    expect(nodes()).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(nodes()).toHaveLength(3);
  });
});
