import { act, render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { pathInWorld, type Path } from '@weasel-js/core';
import { PathAnchorEditDemo } from '../PathAnchorEditDemo';

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
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
function kiteCoords(): number[] {
  const kite = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'kite')!;
  const world = pathInWorld((kite.data as { path: Path }).path, kite.pose as never);
  return Array.from((world as { coords: ArrayLike<number> }).coords);
}
function fired(): string[] {
  const log = (window as unknown as { __weaselDispatchLog__?: { kind: string; fired?: string | null }[] })
    .__weaselDispatchLog__ ?? [];
  return log.flatMap((e) => (e.kind === 'dispatch' && e.fired ? [e.fired] : []));
}

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
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
});
