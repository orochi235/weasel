import { describe, expect, it } from 'vitest';
import type { OngoingHandle, OngoingOverlay } from '@weasel-js/core';
import { collectOverlayBoxes } from './overlays3d';

/** The pane's top-left in client coordinates — what a box is measured from. */
const ORIGIN = { x: 40, y: 20 };

function handle(overlay: OngoingOverlay | null): OngoingHandle {
  return { overlay: () => overlay } as unknown as OngoingHandle;
}

const marquee = (start: { x: number; y: number }, current: { x: number; y: number }): OngoingOverlay =>
  ({ kind: 'marquee', start, current, shiftHeld: false });

describe('collectOverlayBoxes', () => {
  it('is empty when nothing is in flight', () => {
    expect(collectOverlayBoxes([], ORIGIN)).toEqual([]);
  });

  it('rebases a marquee onto the pane and normalizes a backwards drag', () => {
    const boxes = collectOverlayBoxes(
      [handle(marquee({ x: 140, y: 120 }, { x: 100, y: 60 }))],
      ORIGIN,
    );
    expect(boxes).toEqual([{ x: 60, y: 40, width: 40, height: 60, tint: 'gesture' }]);
  });

  it('draws the box a drag-to-insert is proposing', () => {
    const boxes = collectOverlayBoxes(
      [handle({
        kind: 'insertPreview',
        shape: 'rect',
        bounds: { x: 100, y: 60, width: 30, height: 20 },
        extras: undefined,
      } as OngoingOverlay)],
      ORIGIN,
    );
    expect(boxes).toEqual([{ x: 60, y: 40, width: 30, height: 20, tint: 'gesture' }]);
  });

  it('drops a marquee that has not moved', () => {
    expect(collectOverlayBoxes([handle(marquee({ x: 100, y: 60 }, { x: 100, y: 60 }))], ORIGIN))
      .toEqual([]);
  });

  it('skips a handle publishing no overlay', () => {
    expect(collectOverlayBoxes([handle(null), { } as OngoingHandle], ORIGIN)).toEqual([]);
  });

  it('skips a run of points, which this renderer draws no path for', () => {
    const boxes = collectOverlayBoxes(
      [handle({ kind: 'polyline', points: [{ x: 100, y: 60 }, { x: 140, y: 90 }], role: 'cut' })],
      ORIGIN,
    );
    expect(boxes).toEqual([]);
  });
});
