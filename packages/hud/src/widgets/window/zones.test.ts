import { describe, it, expect } from 'vitest';
import { zoneAt, windowContentRect, applyWindowDrag, DEFAULT_WINDOW_METRICS as M } from './zones';

const B = { x: 100, y: 100, w: 200, h: 150 };

describe('zoneAt', () => {
  it('returns null outside the bounds', () => {
    expect(zoneAt(B, M, 99, 100)).toBe(null);
    expect(zoneAt(B, M, 300, 250)).toBe(null);
  });

  it('resolves corners before edges', () => {
    expect(zoneAt(B, M, 101, 101)).toBe('nw');
    expect(zoneAt(B, M, 299, 101)).toBe('ne');
    expect(zoneAt(B, M, 101, 249)).toBe('sw');
    expect(zoneAt(B, M, 299, 249)).toBe('se');
  });

  it('resolves the four edges away from corners', () => {
    expect(zoneAt(B, M, 200, 101)).toBe('n');
    expect(zoneAt(B, M, 200, 249)).toBe('s');
    expect(zoneAt(B, M, 101, 175)).toBe('w');
    expect(zoneAt(B, M, 299, 175)).toBe('e');
  });

  it('resolves the close box inside the titlebar, at the right', () => {
    expect(zoneAt(B, M, 300 - M.edge - M.closeSize / 2, 100 + M.titleH / 2)).toBe('close');
  });

  it('resolves the titlebar left of the close box', () => {
    expect(zoneAt(B, M, 150, 100 + M.titleH / 2)).toBe('title');
  });

  it('resolves everything else as content', () => {
    expect(zoneAt(B, M, 200, 200)).toBe('content');
  });
});

describe('windowContentRect', () => {
  it('insets by the border on three sides and the titlebar on top', () => {
    expect(windowContentRect(B, M)).toEqual({
      x: 100 + M.edge,
      y: 100 + M.titleH,
      w: 200 - M.edge * 2,
      h: 150 - M.titleH - M.edge,
    });
  });
});

describe('applyWindowDrag', () => {
  it('title translates without resizing', () => {
    expect(applyWindowDrag(B, 'title', 10, -5, 80, 60)).toEqual({ x: 110, y: 95, w: 200, h: 150 });
  });

  it('east grows width only', () => {
    expect(applyWindowDrag(B, 'e', 20, 99, 80, 60)).toEqual({ x: 100, y: 100, w: 220, h: 150 });
  });

  it('west moves the left edge and keeps the right edge fixed', () => {
    expect(applyWindowDrag(B, 'w', 20, 0, 80, 60)).toEqual({ x: 120, y: 100, w: 180, h: 150 });
  });

  it('west clamps at min width without moving the right edge', () => {
    const r = applyWindowDrag(B, 'w', 500, 0, 80, 60);
    expect(r).toEqual({ x: 220, y: 100, w: 80, h: 150 });
    expect(r.x + r.w).toBe(B.x + B.w);
  });

  it('north clamps at min height without moving the bottom edge', () => {
    const r = applyWindowDrag(B, 'n', 0, 500, 80, 60);
    expect(r).toEqual({ x: 100, y: 190, w: 200, h: 60 });
    expect(r.y + r.h).toBe(B.y + B.h);
  });

  it('south-east grows both axes and clamps both at the minimum', () => {
    expect(applyWindowDrag(B, 'se', 10, 10, 80, 60)).toEqual({ x: 100, y: 100, w: 210, h: 160 });
    expect(applyWindowDrag(B, 'se', -500, -500, 80, 60)).toEqual({ x: 100, y: 100, w: 80, h: 60 });
  });

  it('content and close never change bounds', () => {
    expect(applyWindowDrag(B, 'content', 40, 40, 80, 60)).toEqual(B);
    expect(applyWindowDrag(B, 'close', 40, 40, 80, 60)).toEqual(B);
  });
});
