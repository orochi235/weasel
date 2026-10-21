import { describe, expect, it } from 'vitest';
import { placeMenu, placeMenuUnder, placeSubmenu } from './placement';

const bounds = { x: 0, y: 0, w: 800, h: 600 };
const size = { w: 200, h: 300 };

describe('placeMenu', () => {
  it('opens down and right of the anchor when it fits', () => {
    expect(placeMenu(size, { x: 100, y: 100 }, bounds)).toEqual({ x: 100, y: 100 });
  });
  it('flips left at the right edge', () => {
    expect(placeMenu(size, { x: 700, y: 100 }, bounds)).toEqual({ x: 500, y: 100 });
  });
  it('flips up at the bottom edge', () => {
    expect(placeMenu(size, { x: 100, y: 500 }, bounds)).toEqual({ x: 100, y: 200 });
  });
  it('shifts inside when neither side fits', () => {
    expect(placeMenu({ w: 200, h: 500 }, { x: 100, y: 300 }, bounds)).toEqual({ x: 100, y: 100 });
  });
  it('pins to the near edge when the menu is larger than the bounds', () => {
    expect(placeMenu({ w: 200, h: 900 }, { x: 100, y: 300 }, bounds)).toEqual({ x: 100, y: 0 });
  });
  it('stays inside when the anchor is past the far edge', () => {
    expect(placeMenu(size, { x: 1000, y: 700 }, bounds)).toEqual({ x: 600, y: 300 });
  });
  it('respects a bounds origin that is not zero', () => {
    expect(placeMenu(size, { x: 950, y: 150 }, { x: 100, y: 100, w: 900, h: 600 }))
      .toEqual({ x: 750, y: 150 });
  });
});

describe('placeSubmenu', () => {
  const row = { x: 100, y: 120, w: 200, h: 24 };
  it('opens to the right of its row, top-aligned', () => {
    expect(placeSubmenu(size, row, bounds)).toEqual({ x: 300, y: 120 });
  });
  it('opens to the left when the right side does not fit', () => {
    expect(placeSubmenu(size, { ...row, x: 500 }, bounds)).toEqual({ x: 300, y: 120 });
  });
  it('shifts up so its bottom stays inside', () => {
    expect(placeSubmenu(size, { ...row, y: 500 }, bounds)).toEqual({ x: 300, y: 300 });
  });
});

describe('placeMenuUnder', () => {
  it('opens below the rect, left-aligned', () => {
    expect(placeMenuUnder(size, { x: 100, y: 20, w: 60, h: 24 }, bounds)).toEqual({ x: 100, y: 44 });
  });
  it('flips above the rect when below does not fit', () => {
    expect(placeMenuUnder(size, { x: 100, y: 560, w: 60, h: 24 }, bounds)).toEqual({ x: 100, y: 260 });
  });
  it('right-aligns to the rect when left-aligned would clip', () => {
    expect(placeMenuUnder(size, { x: 700, y: 20, w: 60, h: 24 }, bounds)).toEqual({ x: 560, y: 44 });
  });
  it('shifts inside the bounds when neither side fits', () => {
    expect(placeMenuUnder({ w: 200, h: 390 }, { x: 100, y: 180, w: 60, h: 24 }, { x: 0, y: 0, w: 800, h: 400 }))
      .toEqual({ x: 100, y: 10 });
  });
  it('opens above the rect when asked and the top fits', () => {
    expect(placeMenuUnder({ w: 100, h: 50 }, { x: 10, y: 200, w: 40, h: 20 }, bounds, true)).toEqual({ x: 10, y: 150 });
  });
  it('flips below when asked above with no room there', () => {
    expect(placeMenuUnder({ w: 100, h: 50 }, { x: 10, y: 20, w: 40, h: 20 }, bounds, true)).toEqual({ x: 10, y: 40 });
  });
  it('stays below by default', () => {
    expect(placeMenuUnder({ w: 100, h: 50 }, { x: 10, y: 200, w: 40, h: 20 }, bounds)).toEqual({ x: 10, y: 220 });
  });
});
