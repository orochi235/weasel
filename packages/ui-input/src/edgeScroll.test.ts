import { describe, expect, it } from 'vitest';
import { EDGE_SCROLL_MARGIN, edgePush, edgeScroll } from './edgeScroll';

const TRACK = { from: 0, to: 400 };

describe('edgePush', () => {
  it('is still in the middle and exactly at the margin', () => {
    expect(edgePush(TRACK, 200, 50)).toBe(0);
    expect(edgePush(TRACK, 50, 50)).toBe(0);
    expect(edgePush(TRACK, 350, 50)).toBe(0);
  });
  it('rises linearly toward an end', () => {
    expect(edgePush(TRACK, 40, 50)).toBeCloseTo(-0.2);
    expect(edgePush(TRACK, 10, 50)).toBeCloseTo(-0.8);
    expect(edgePush(TRACK, 390, 50)).toBeCloseTo(0.8);
  });
  it('is at full strength at an end and holds it past there', () => {
    expect(edgePush(TRACK, 0, 50)).toBe(-1);
    expect(edgePush(TRACK, 400, 50)).toBe(1);
    expect(edgePush(TRACK, -200, 50)).toBe(-1);
    expect(edgePush(TRACK, 900, 50)).toBe(1);
  });
  it('picks the nearer end of a span narrower than two margins', () => {
    const narrow = { from: 0, to: 60 };
    expect(edgePush(narrow, 45, 50)).toBeGreaterThan(0);
    expect(edgePush(narrow, 15, 50)).toBeLessThan(0);
  });
  it('is off with no margin', () => {
    expect(edgePush(TRACK, 0, 0)).toBe(0);
    expect(edgePush(TRACK, 0, -5)).toBe(0);
  });
  it('has a default margin', () => {
    expect(edgePush(TRACK, EDGE_SCROLL_MARGIN)).toBe(0);
    expect(edgePush(TRACK, 2)).toBeLessThan(0);
  });
});

describe('edgeScroll', () => {
  const BOX = { x: 100, y: 0, width: 400, height: 300 };
  it('reads each axis on its own', () => {
    expect(edgeScroll(BOX, { x: 300, y: 150 }, 50)).toEqual({ x: 0, y: 0 });
    expect(edgeScroll(BOX, { x: 100, y: 150 }, 50)).toEqual({ x: -1, y: 0 });
    expect(edgeScroll(BOX, { x: 500, y: 300 }, 50)).toEqual({ x: 1, y: 1 });
  });
});
