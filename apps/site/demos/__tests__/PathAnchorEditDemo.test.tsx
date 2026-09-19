import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { pathInWorld, type Path } from '@weasel-js/core';
import { PathAnchorEditDemo } from '../PathAnchorEditDemo';

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number, altKey = false) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, altKey }));
}
function altClick(canvas: HTMLCanvasElement, x: number, y: number) {
  act(() => {
    pointer(canvas, 'pointerdown', x, y, true);
    pointer(canvas, 'pointerup', x, y, true);
  });
}
function doubleClick(canvas: HTMLCanvasElement, x: number, y: number) {
  act(() => {
    for (let i = 0; i < 2; i++) {
      pointer(canvas, 'pointerdown', x, y);
      pointer(canvas, 'pointerup', x, y);
    }
  });
}
function drag(canvas: HTMLCanvasElement, [x0, y0]: number[], [x1, y1]: number[]) {
  act(() => {
    pointer(canvas, 'pointerdown', x0, y0);
    pointer(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    pointer(canvas, 'pointermove', x1, y1);
    pointer(canvas, 'pointerup', x1, y1);
  });
}

// World space: an anchor edit re-stores the path relative to its new bounds.
function worldPath(id: string): { commands: ArrayLike<number>; coords: ArrayLike<number> } {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!;
  return pathInWorld((node.data as { path: Path }).path, node.pose as never) as never;
}
function kiteCoords(): number[] {
  return Array.from(worldPath('kite').coords);
}
function fired(): string[] {
  const log = (window as unknown as { __weaselDispatchLog__?: { kind: string; fired?: string | null }[] })
    .__weaselDispatchLog__ ?? [];
  return log.flatMap((e) => (e.kind === 'dispatch' && e.fired ? [e.fired] : []));
}

/** Unit normal pointing out of the kite across its first edge, (140,40) → (220,140). */
const OUT = { x: 100 / Math.hypot(100, 80), y: -80 / Math.hypot(100, 80) };

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('PathAnchorEditDemo', () => {
  // The demo wires no mode registry. Every assertion below depends on the
  // SceneCanvas branches that run when `getActiveMode` is absent: no
  // eligibility filter, and nothing revoking edit mode.
  it('enters anchor editing on double-click, drags one anchor, and exits on Escape', () => {
    const { container } = render(<PathAnchorEditDemo />);
    const canvas = container.querySelector('canvas')!;
    const before = kiteCoords();

    doubleClick(canvas, 140, 140);
    expect(fired()).toContain('enterPathEdit');

    // Kite anchor 1 sits at (220, 140): coords 2 and 3.
    drag(canvas, [220, 140], [260, 170]);
    expect(fired().at(-1)).toBe('editAnchors');
    const edited = kiteCoords();
    expect(edited.slice(2, 4)).toEqual([260, 170]);
    expect([...edited.slice(0, 2), ...edited.slice(4)]).toEqual([...before.slice(0, 2), ...before.slice(4)]);

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(fired().at(-1)).toBe('exitPathEdit');

    // Out of edit mode, the same press moves the whole shape.
    drag(canvas, [140, 140], [150, 150]);
    expect(fired().at(-1)).toBe('move');
  });

  it('inserts an anchor where an Alt+click lands on a segment, and undoes it', () => {
    const { container } = render(<PathAnchorEditDemo />);
    const canvas = container.querySelector('canvas')!;
    doubleClick(canvas, 140, 140);
    const before = kiteCoords();

    // A quarter of the way along the first edge, pressed 2px off the line.
    altClick(canvas, 160 + 2 * OUT.x, 65 + 2 * OUT.y);
    expect(fired().at(-1)).toBe('insertPathAnchor');
    const after = kiteCoords();
    expect(after).toHaveLength(before.length + 2);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    // Coords are float32, stored relative to the node's pose.
    expect(after[2]).toBeCloseTo(160, 3);
    expect(after[3]).toBeCloseTo(65, 3);
    expect(after.slice(4)).toEqual(before.slice(2));
    // Still all straight lines: M, four Ls, Z.
    expect(Array.from(worldPath('kite').commands)).toHaveLength(6);

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); });
    expect(kiteCoords()).toEqual(before);
  });

  it('splits the closing edge of a closed path', () => {
    const { container } = render(<PathAnchorEditDemo />);
    const canvas = container.querySelector('canvas')!;
    doubleClick(canvas, 140, 140);
    const before = kiteCoords();
    // Midpoint of the implicit closing edge (60,140) → (140,40).
    altClick(canvas, 100, 90);
    expect(fired().at(-1)).toBe('insertPathAnchor');
    expect(kiteCoords()).toEqual([...before, 100, 90]);
  });

  it('leaves the path alone when the Alt+click misses every segment', () => {
    const { container } = render(<PathAnchorEditDemo />);
    const canvas = container.querySelector('canvas')!;
    doubleClick(canvas, 140, 140);
    const before = kiteCoords();
    altClick(canvas, 140, 140);
    expect(fired().at(-1)).not.toBe('insertPathAnchor');
    // On an anchor is the anchor's, not the segment's.
    altClick(canvas, 220, 140);
    expect(fired().at(-1)).not.toBe('insertPathAnchor');
    expect(kiteCoords()).toEqual(before);
  });

  it('shows the insert cursor only over a segment while Alt is down', () => {
    const { container } = render(<PathAnchorEditDemo />);
    const canvas = container.querySelector('canvas')!;
    doubleClick(canvas, 140, 140);
    const hover = (x: number, y: number, altKey: boolean) => {
      act(() => { pointer(canvas, 'pointermove', x, y, altKey); });
      return canvas.style.cursor;
    };
    // Just outside the edge: over the body, an Alt+drag would clone, and a
    // drag's cursor outranks a click's.
    const x = 180 + 7 * OUT.x, y = 90 + 7 * OUT.y;
    const onSegment = hover(x, y, true);
    expect(onSegment).toMatch(/^url\(/);
    expect(hover(x, y, false)).not.toBe(onSegment);
    expect(hover(300, 40, true)).not.toBe(onSegment);
  });
});
