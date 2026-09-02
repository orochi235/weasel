import { describe, it, expect } from 'vitest';
import { placeRect, clampRectWithin } from './place';
import type { Rect } from './box';

const BOUNDARY: Rect = { x: 0, y: 0, width: 1000, height: 800 };
const ANCHOR: Rect = { x: 400, y: 100, width: 100, height: 50 };
const OVERLAY = { width: 200, height: 80 };

describe('placeRect', () => {
  it('places the overlay below the anchor, offset by the gap', () => {
    const { rect } = placeRect({
      anchor: ANCHOR,
      overlay: OVERLAY,
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'center' },
      offset: 8,
    });
    expect(rect.y).toBe(158);
  });

  it('centers the overlay across the anchor', () => {
    const { rect } = placeRect({
      anchor: ANCHOR,
      overlay: OVERLAY,
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'center' },
      offset: 8,
    });
    expect(rect.x).toBe(350);
  });

  it('aligns leading edges for align start', () => {
    const { rect } = placeRect({
      anchor: ANCHOR,
      overlay: OVERLAY,
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'start' },
      offset: 8,
    });
    expect(rect.x).toBe(400);
  });

  it('aligns trailing edges for align end', () => {
    const { rect } = placeRect({
      anchor: ANCHOR,
      overlay: OVERLAY,
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'end' },
      offset: 8,
    });
    expect(rect.x).toBe(300);
  });

  it('flips to the opposite side when the preferred side has no room', () => {
    const { rect, placement } = placeRect({
      anchor: { x: 400, y: 740, width: 100, height: 50 },
      overlay: OVERLAY,
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'start' },
      offset: 8,
    });
    expect(placement).toEqual({ side: 'top', align: 'start' });
    expect(rect.y).toBe(652);
  });

  it('flips left to right as well as bottom to top', () => {
    const { rect, placement } = placeRect({
      anchor: { x: 20, y: 300, width: 40, height: 40 },
      overlay: { width: 120, height: 60 },
      boundary: BOUNDARY,
      placement: { side: 'left', align: 'center' },
      offset: 10,
    });
    expect(placement.side).toBe('right');
    expect(rect.x).toBe(70);
  });

  it('keeps the preferred side when neither side has room', () => {
    const { rect, placement } = placeRect({
      anchor: { x: 0, y: 40, width: 10, height: 20 },
      overlay: { width: 10, height: 200 },
      boundary: { x: 0, y: 0, width: 1000, height: 100 },
      placement: { side: 'bottom', align: 'start' },
    });
    expect(placement.side).toBe('bottom');
    expect(rect.y).toBe(60);
  });

  it('does not flip when flipping is disabled', () => {
    const { rect, placement } = placeRect({
      anchor: { x: 400, y: 740, width: 100, height: 50 },
      overlay: OVERLAY,
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'start' },
      offset: 8,
      flip: false,
    });
    expect(placement.side).toBe('bottom');
    expect(rect.y).toBe(798);
  });

  it('shifts along the cross axis to stay inside the boundary', () => {
    const { rect } = placeRect({
      anchor: { x: 960, y: 100, width: 20, height: 20 },
      overlay: { width: 200, height: 50 },
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'center' },
    });
    expect(rect.x).toBe(800);
  });

  it('keeps padding between the overlay and the boundary when shifting', () => {
    const { rect } = placeRect({
      anchor: { x: 960, y: 100, width: 20, height: 20 },
      overlay: { width: 200, height: 50 },
      boundary: BOUNDARY,
      placement: { side: 'bottom', align: 'center' },
      padding: 12,
    });
    expect(rect.x).toBe(788);
  });

  it('resolves against a boundary that does not start at the origin', () => {
    const { rect } = placeRect({
      anchor: { x: 460, y: 60, width: 20, height: 20 },
      overlay: { width: 100, height: 40 },
      boundary: { x: 100, y: 50, width: 400, height: 300 },
      placement: { side: 'bottom', align: 'center' },
      offset: 8,
    });
    expect(rect.x).toBe(400);
  });

  it('pins to the leading edge when the overlay is wider than the boundary', () => {
    const { rect } = placeRect({
      anchor: { x: 150, y: 60, width: 20, height: 20 },
      overlay: { width: 400, height: 40 },
      boundary: { x: 100, y: 50, width: 200, height: 300 },
      placement: { side: 'bottom', align: 'center' },
      padding: 10,
    });
    expect(rect.x).toBe(110);
  });

  it('places the overlay left of the anchor for side left', () => {
    const { rect } = placeRect({
      anchor: { x: 400, y: 300, width: 100, height: 50 },
      overlay: { width: 120, height: 60 },
      boundary: BOUNDARY,
      placement: { side: 'left', align: 'center' },
      offset: 10,
    });
    expect(rect).toEqual({ x: 270, y: 295, width: 120, height: 60 });
  });
});

describe('clampRectWithin', () => {
  it('leaves a rect that is already inside alone', () => {
    const r: Rect = { x: 10, y: 20, width: 100, height: 50 };
    expect(clampRectWithin(r, BOUNDARY)).toEqual(r);
  });

  it('pulls a rect back inside past the far edges', () => {
    const r: Rect = { x: 950, y: 770, width: 100, height: 80 };
    expect(clampRectWithin(r, BOUNDARY)).toEqual({ x: 900, y: 720, width: 100, height: 80 });
  });

  it('pulls a rect back inside past the near edges', () => {
    const r: Rect = { x: -30, y: -10, width: 100, height: 80 };
    expect(clampRectWithin(r, BOUNDARY)).toEqual({ x: 0, y: 0, width: 100, height: 80 });
  });

  it('pins to the leading edge when the rect is larger than the boundary', () => {
    const r: Rect = { x: 400, y: 400, width: 1200, height: 900 };
    expect(clampRectWithin(r, BOUNDARY)).toEqual({ x: 0, y: 0, width: 1200, height: 900 });
  });

  it('clamps against a boundary that does not start at the origin', () => {
    const r: Rect = { x: 0, y: 0, width: 50, height: 50 };
    const boundary: Rect = { x: 100, y: 50, width: 400, height: 300 };
    expect(clampRectWithin(r, boundary)).toEqual({ x: 100, y: 50, width: 50, height: 50 });
  });

  it('keeps padding between the rect and the boundary', () => {
    const r: Rect = { x: 990, y: 0, width: 100, height: 80 };
    expect(clampRectWithin(r, BOUNDARY, 12)).toEqual({ x: 888, y: 12, width: 100, height: 80 });
  });
});
