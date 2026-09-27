import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { rotatePoint } from '@weasel-js/core';
import { RotatedResizeMathDemo } from '../RotatedResizeMathDemo';

/** Parse "(x, y)" out of a panel's "fixed corner: (x, y)" ledger caption. */
function captionCoords(panel: Element): { x: number; y: number } {
  const body = panel.querySelector('.rrmd-caption-body')!.textContent!;
  const m = body.match(/\((-?[\d.]+), (-?[\d.]+)\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

describe('RotatedResizeMathDemo', () => {
  it('commits the drag to the scene on pointerup (pose survives gesture end)', () => {
    const { container } = render(<RotatedResizeMathDemo />);
    const green = container.querySelector('.rrmd-panel')!;
    const canvas = green.querySelector('canvas')!;
    // jsdom rects are all-zero; localCoords needs the real canvas box.
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, x: 0, y: 0, width: 320, height: 240,
      right: 320, bottom: 240, toJSON: () => ({}),
    }) as DOMRect;

    const before = captionCoords(green);

    // Body-translate: down at the rect center (160,120), drag +50,+30, up.
    // Fired on the panel, not on `window`: the gesture's pointer session
    // listens on the document, which a window-dispatched event never reaches.
    fireEvent.pointerDown(green, { clientX: 160, clientY: 120, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(green, { clientX: 210, clientY: 150, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(green, { clientX: 210, clientY: 150, pointerId: 1 });

    // After the gesture the live ghost is gone and the caption reads the
    // COMMITTED pose — it must reflect the translate, not snap back.
    const after = captionCoords(green);
    expect(after.x).toBeCloseTo(before.x + 50, 1);
    expect(after.y).toBeCloseTo(before.y + 30, 1);
  });

  it("keeps reporting the gesture's fixed corner after the drag is released", () => {
    const { container } = render(<RotatedResizeMathDemo />);
    const green = container.querySelector('.rrmd-panel')!;
    const canvas = green.querySelector('canvas')!;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, x: 0, y: 0, width: 320, height: 240,
      right: 320, bottom: 240, toJSON: () => ({}),
    }) as DOMRect;

    // Initial pose (80,70,160,100) rotated 30° about (160,120). Grab the
    // top-left handle, which pins the bottom-right corner.
    const topLeft = rotatePoint(80, 70, 160, 120, Math.PI / 6);
    const bottomRight = rotatePoint(240, 170, 160, 120, Math.PI / 6);

    fireEvent.pointerDown(green, { clientX: topLeft.x, clientY: topLeft.y, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(green, { clientX: topLeft.x + 30, clientY: topLeft.y + 20, pointerId: 1, buttons: 1 });
    const during = captionCoords(green);
    fireEvent.pointerUp(green, { clientX: topLeft.x + 30, clientY: topLeft.y + 20, pointerId: 1 });
    const after = captionCoords(green);

    expect(during.x).toBeCloseTo(bottomRight.x, 1);
    expect(during.y).toBeCloseTo(bottomRight.y, 1);
    expect(after.x).toBeCloseTo(bottomRight.x, 1);
    expect(after.y).toBeCloseTo(bottomRight.y, 1);
  });
});
