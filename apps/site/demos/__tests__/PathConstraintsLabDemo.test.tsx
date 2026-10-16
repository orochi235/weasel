import { act, cleanup, screen } from '@testing-library/react';
import { pathAnchorPoints, pathInWorld, type PolygonPath, type RectPose } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PathConstraintsLabDemo } from '../PathConstraintsLabDemo';

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

/** The shape's anchors in world coords. */
function anchors() {
  const node = window.__weaselTest!.getScene().nodes[0] as unknown as { pose: RectPose; data: { path: PolygonPath } };
  return pathAnchorPoints(pathInWorld(node.data.path, node.pose) as PolygonPath);
}

const cross = (p: { x: number; y: number }[], [a, b]: number[], [c, d]: number[]) =>
  (p[b].x - p[a].x) * (p[d].y - p[c].y) - (p[b].y - p[a].y) * (p[d].x - p[c].x);

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

describe('PathConstraintsLabDemo', () => {
  it('keeps the seeded parallelogram one when a corner is dragged', async () => {
    const { container } = await renderSettled(<StrictMode><PathConstraintsLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(screen.getByRole('status').textContent).toBe('4 constraints, all holding.');

    drag(canvas, [420, 140], [460, 180]);

    const p = anchors();
    expect(p[2].x).toBeCloseTo(460, 2);
    expect(p[2].y).toBeCloseTo(180, 2);
    // The fixed corner stays, the bottom edge stays level, and both pairs of sides stay parallel.
    expect(p[0]).toEqual({ x: 140, y: 300 });
    expect(p[1].y).toBeCloseTo(300, 2);
    expect(Math.abs(cross(p, [0, 1], [3, 2]))).toBeLessThan(0.5);
    expect(Math.abs(cross(p, [1, 2], [0, 3]))).toBeLessThan(0.5);
    expect(screen.getByRole('status').textContent).toBe('4 constraints, all holding.');
  });

  it('adds the kind the control panel picks to the selected anchors on C', async () => {
    const { container } = await renderSettled(<StrictMode><PathConstraintsLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const click = clicker(canvas);
    click(140, 300);
    click(340, 300, true);
    click(420, 140, true);
    key(canvas, 'c');

    expect(screen.getByRole('status').textContent).toBe('5 constraints, all holding.');
    // Perpendicular at corner 1 on top of the rest makes a rectangle.
    const p = anchors();
    expect(p[2].x).toBeCloseTo(p[1].x, 2);
  });

  it('deletes a clicked anchor rather than the shape, renumbering the constraints', async () => {
    const { container } = await renderSettled(<StrictMode><PathConstraintsLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    clicker(canvas)(420, 140);
    key(canvas, 'Delete');
    expect(anchors()).toHaveLength(3);
    // Both parallels named corner 2; the horizontal edge and the fixed corner remain.
    expect(screen.getByRole('status').textContent).toBe('2 constraints, all holding.');
  });

  it('nudges a clicked anchor with the arrows rather than the whole shape', async () => {
    const { container } = await renderSettled(<StrictMode><PathConstraintsLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    clicker(canvas)(420, 140);
    key(canvas, 'ArrowUp');
    const p = anchors();
    expect(p[0]).toEqual({ x: 140, y: 300 });
    expect(p[2].y).toBeLessThan(140);
  });

  it('deletes a constraint whose mark is clicked', async () => {
    const { container } = await renderSettled(<StrictMode><PathConstraintsLabDemo /></StrictMode>);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    // The bottom edge's H sits 12 above its midpoint, inside the shape.
    clicker(canvas)(240, 288);
    key(canvas, 'Delete');
    expect(screen.getByRole('status').textContent).toBe('3 constraints, all holding.');
    expect(anchors()).toHaveLength(4);
  });
});

function clicker(canvas: Element) {
  return (x: number, y: number, shiftKey = false) => act(() => {
    for (const type of ['pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === 'pointerdown' ? 1 : 0, shiftKey }));
    }
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: 0, shiftKey }));
  });
}

function key(canvas: Element, name: string) {
  act(() => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: name }));
    canvas.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: name }));
  });
}
