import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GROUP_ID, PETAL_ID, SymmetryLabDemo } from '../SymmetryLabDemo';
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

type Node = {
  id: string; parent?: string;
  pose: { x: number; y: number; width: number; height: number };
  data: { path?: { coords: ArrayLike<number> }; symmetry?: { glideRows?: boolean } };
};
const nodes = () => window.__weaselTest!.getScene().nodes as unknown as Node[];
const node = (id: string) => nodes().find((n) => n.id === id)!;

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

async function mount() {
  const { container } = await renderSettled(<SymmetryLabDemo />, { wrapper: withIcons });
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('SymmetryLabDemo', () => {
  it('keeps the petal its own mirror image when its tip handle is dragged', async () => {
    const canvas = await mount();
    drag(canvas, [435, 275], [470, 300]);
    const { data, pose } = node(PETAL_ID);
    const c = data.path!.coords;
    const ys: number[] = [];
    for (let i = 1; i < c.length; i += 2) ys.push(c[i] + pose.y);
    // Mirrored across y = 240, every y has its partner at 480 - y.
    const sorted = [...ys].sort((a, b) => a - b);
    sorted.forEach((y, i) => expect(y + sorted[sorted.length - 1 - i]).toBeCloseTo(480, 3));
    expect(Math.max(...ys)).toBeCloseTo(300, 3);
  });

  it('draws a new shape into the group', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('button', { name: /^Rectangle/ }));
    const before = nodes().length;
    drag(canvas, [100, 60], [140, 90]);
    const added = nodes().slice(before);
    expect(added).toHaveLength(1);
    expect(added[0].parent).toBe(GROUP_ID);
  });

  it('draws at the top of the tree once Draw into the group is off', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Draw into the group' }));
    await userEvent.click(screen.getByRole('button', { name: /^Rectangle/ }));
    const before = nodes().length;
    drag(canvas, [100, 60], [140, 90]);
    expect(nodes().slice(before).map((n) => n.parent ?? null)).toEqual([null]);
  });

  it('turns the glide onto rows and back from its checkbox', async () => {
    await mount();
    const rows = screen.getByRole('checkbox', { name: 'Glide rows' });
    expect(rows).not.toBeChecked();
    await userEvent.click(rows);
    expect(node(GROUP_ID).data.symmetry?.glideRows).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Glide rows' }));
    expect(node(GROUP_ID).data.symmetry?.glideRows ?? false).toBe(false);
  });
});
