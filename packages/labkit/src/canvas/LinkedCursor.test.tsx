import { render } from '@testing-library/react';
import { createPointerStore, PointerContextProvider, type ViewApi } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { CameraContext } from './CameraInput';
import { LinkedCursor } from './LinkedCursor';
import type { WorldFrame } from './worldSpec';

function bars(frame: WorldFrame, world: { x: number; y: number }) {
  const store = createPointerStore();
  store.set({ world, viewId: 'overview' });
  // Zoom 2 about the frame origin: frame-local (x, y) lands at (2x, 2y).
  const view: ViewApi = { get: () => ({ x: 0, y: 0, scale: { x: 2, y: 2 } }), set: () => {} };
  const { container } = render(
    <PointerContextProvider store={store}>
      <CameraContext.Provider value={{ view, frame, element: () => null }}>
        <LinkedCursor />
      </CameraContext.Provider>
    </PointerContextProvider>,
  );
  return [...container.querySelectorAll('.lk-linked-cursor__bar')];
}

/** Where the crosshair's arms meet: the vertical arms share x, the horizontal share y. */
function center(rects: Element[]) {
  const n = (r: Element, a: string) => Number(r.getAttribute(a));
  const horizontal = rects.filter((r) => n(r, 'width') > n(r, 'height'));
  const vertical = rects.filter((r) => n(r, 'height') > n(r, 'width'));
  return {
    x: n(vertical[0], 'x') + n(vertical[0], 'width') / 2,
    y: n(horizontal[0], 'y') + n(horizontal[0], 'height') / 2,
  };
}

describe('LinkedCursor', () => {
  it('draws the shared pointer where the world point sits under a y-up frame', () => {
    const up: WorldFrame = { originPx: { x: 0, y: 0 }, yDir: -1 };
    // World (20, -15) is frame-local (20, 15): screen (40, 30) at zoom 2.
    const at = center(bars(up, { x: 20, y: -15 }));
    expect(at.x).toBeCloseTo(40, 0);
    expect(at.y).toBeCloseTo(30, 0);
  });

  it('draws it unflipped under a y-down frame', () => {
    const down: WorldFrame = { originPx: { x: 0, y: 0 }, yDir: 1 };
    const at = center(bars(down, { x: 20, y: 15 }));
    expect(at.x).toBeCloseTo(40, 0);
    expect(at.y).toBeCloseTo(30, 0);
  });
});
