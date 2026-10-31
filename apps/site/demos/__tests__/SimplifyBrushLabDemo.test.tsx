import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PenAnchor, type PolygonPath, pathInWorld, pathToAnchors, type RectPose } from '@weasel-js/core';
import { cubicPointAt } from '@weasel-js/geom';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_PATH_ID, SimplifyBrushLabDemo } from '../SimplifyBrushLabDemo';
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

/** The scribble's anchors where they are drawn, in world coords. */
const scribble = (): PenAnchor[] => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === SEEDED_PATH_ID);
  const path = (node?.data as { path: PolygonPath }).path;
  return pathToAnchors(pathInWorld(path, node!.pose as RectPose) as PolygonPath).anchors.flat();
};

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function dragThrough(canvas: Element, points: readonly { x: number; y: number }[]) {
  const at = (type: string, p: { x: number; y: number }) =>
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1, button: 0, buttons: 1,
    }));
  act(() => {
    at('pointerdown', points[0]);
    for (const p of points.slice(1)) at('pointermove', p);
    at('pointerup', points[points.length - 1]);
  });
}

/** The farthest any of `pts` lies from the polyline through `line`. */
function farthest(pts: readonly { x: number; y: number }[], line: readonly { x: number; y: number }[]): number {
  let worst = 0;
  for (const p of pts) {
    let best = Infinity;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

/** A stroke along the scribble itself, from its 40th anchor to its 160th. */
const alongScribble = () => scribble().slice(40, 161).filter((_, i) => i % 4 === 0);

/** The lab as the site mounts it, under StrictMode, which runs every effect twice. */
async function mount() {
  const { container } = await renderSettled(<StrictMode><SimplifyBrushLabDemo /></StrictMode>, { wrapper: withIcons });
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('SimplifyBrushLabDemo', () => {
  it('opens with the brush on: a plain drag thins the stretch it covers, as one undo step', async () => {
    const canvas = await mount();
    const before = scribble().length;
    dragThrough(canvas, alongScribble());
    expect(scribble().length).toBeLessThan(before - 60);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(scribble()).toHaveLength(before);
  });

  it.each([16, 40, 60])('keeps the first wiggle within the tolerance when brushed from the start into the dip (%ipx)', async (radius) => {
    const canvas = await mount();
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'Brush radius' }), { target: { value: String(radius) } });
    });
    const before = scribble();
    const dip = before.slice(0, 80).reduce((best, a, i) => (a.y > before[best].y ? i : best), 0);
    dragThrough(canvas, before.slice(0, dip + 1).filter((_, i) => i % 3 === 0));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const after = scribble();
    expect(after.length).toBeLessThan(before.length);
    const along: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < after.length; i++) {
      const a = after[i], b = after[i + 1];
      for (let k = 0; k <= 16; k++) along.push(cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 16));
    }
    // Both ways: the refit stays near the original, and the original near the refit.
    expect(farthest(along, before)).toBeLessThan(1.05);
    expect(farthest(before, along)).toBeLessThan(1.05);
  });

  it("refits at the control panel's tolerance", async () => {
    const canvas = await mount();
    dragThrough(canvas, alongScribble());
    const atDefault = scribble().length;
    cleanup();

    const again = await mount();
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'Tolerance' }), { target: { value: '20' } });
    });
    dragThrough(again, alongScribble());
    expect(scribble().length).toBeLessThan(atDefault);
  });

  it('edits anchors as usual once Anchors is picked in the palette', async () => {
    const canvas = await mount();
    const before = scribble().length;
    await userEvent.click(screen.getByRole('button', { name: /^Anchors/ }));
    dragThrough(canvas, alongScribble());
    expect(scribble()).toHaveLength(before);
  });
});
