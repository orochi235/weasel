import { describe, expect, it } from 'vitest';
import { placeMenu, placeMenuUnder, placeSubmenu } from './placement';

const bounds = { x: 0, y: 0, width: 800, height: 600 };
const size = { width: 200, height: 300 };

describe('placeMenu', () => {
  it('opens down and right of the anchor when it fits', () => {
    expect(placeMenu(size, { x: 100, y: 100 }, bounds)).toEqual({ x: 100, y: 100 });
  });
  it('flips left at the right edge', () => {
    expect(placeMenu(size, { x: 700, y: 100 }, bounds)).toEqual({ x: 500, y: 100 });
  });
  it('under rtl opens down and left of the anchor, and right when the left does not fit', () => {
    expect(placeMenu(size, { x: 300, y: 100 }, bounds, 'rtl')).toEqual({ x: 100, y: 100 });
    expect(placeMenu(size, { x: 100, y: 100 }, bounds, 'rtl')).toEqual({ x: 100, y: 100 });
  });
  it('flips up at the bottom edge', () => {
    expect(placeMenu(size, { x: 100, y: 500 }, bounds)).toEqual({ x: 100, y: 200 });
  });
  it('shifts inside when neither side fits', () => {
    expect(placeMenu({ width: 200, height: 500 }, { x: 100, y: 300 }, bounds)).toEqual({ x: 100, y: 100 });
  });
  it('pins to the near edge when the menu is larger than the bounds', () => {
    expect(placeMenu({ width: 200, height: 900 }, { x: 100, y: 300 }, bounds)).toEqual({ x: 100, y: 0 });
  });
  it('stays inside when the anchor is past the far edge', () => {
    expect(placeMenu(size, { x: 1000, y: 700 }, bounds)).toEqual({ x: 600, y: 300 });
  });
  it('respects a bounds origin that is not zero', () => {
    expect(placeMenu(size, { x: 950, y: 150 }, { x: 100, y: 100, width: 900, height: 600 }))
      .toEqual({ x: 750, y: 150 });
  });
});

describe('placeSubmenu', () => {
  const row = { x: 100, y: 120, width: 200, height: 24 };
  it('opens to the right of its row, top-aligned', () => {
    expect(placeSubmenu(size, row, bounds)).toEqual({ x: 300, y: 120 });
  });
  it('opens to the left when the right side does not fit', () => {
    expect(placeSubmenu(size, { ...row, x: 500 }, bounds)).toEqual({ x: 300, y: 120 });
  });
  it('shifts up so its bottom stays inside', () => {
    expect(placeSubmenu(size, { ...row, y: 500 }, bounds)).toEqual({ x: 300, y: 300 });
  });
  it('under rtl opens to the left of its row, and to the right when the left does not fit', () => {
    expect(placeSubmenu(size, { ...row, x: 500 }, bounds, 'rtl')).toEqual({ x: 300, y: 120 });
    expect(placeSubmenu(size, row, bounds, 'rtl')).toEqual({ x: 300, y: 120 });
    expect(placeSubmenu(size, { ...row, x: 300 }, bounds, 'rtl')).toEqual({ x: 100, y: 120 });
  });
});

describe('placeMenuUnder', () => {
  it('opens below the rect, left-aligned', () => {
    expect(placeMenuUnder(size, { x: 100, y: 20, width: 60, height: 24 }, bounds)).toEqual({ x: 100, y: 44 });
  });
  it('under rtl opens below the rect, right-aligned', () => {
    expect(placeMenuUnder(size, { x: 300, y: 20, width: 60, height: 24 }, bounds, 'bottom', 'rtl')).toEqual({ x: 160, y: 44 });
    expect(placeMenuUnder(size, { x: 20, y: 20, width: 60, height: 24 }, bounds, 'bottom', 'rtl')).toEqual({ x: 20, y: 44 });
  });
  it('flips above the rect when below does not fit', () => {
    expect(placeMenuUnder(size, { x: 100, y: 560, width: 60, height: 24 }, bounds)).toEqual({ x: 100, y: 260 });
  });
  it('right-aligns to the rect when left-aligned would clip', () => {
    expect(placeMenuUnder(size, { x: 700, y: 20, width: 60, height: 24 }, bounds)).toEqual({ x: 560, y: 44 });
  });
  it('shifts inside the bounds when neither side fits', () => {
    expect(placeMenuUnder({ width: 200, height: 390 }, { x: 100, y: 180, width: 60, height: 24 }, { x: 0, y: 0, width: 800, height: 400 }))
      .toEqual({ x: 100, y: 10 });
  });
  it('opens above the rect when asked and the top fits', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 10, y: 200, width: 40, height: 20 }, bounds, 'top')).toEqual({ x: 10, y: 150 });
  });
  it('flips below when asked above with no room there', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 10, y: 20, width: 40, height: 20 }, bounds, 'top')).toEqual({ x: 10, y: 40 });
  });
  it('opens right of the rect, top-aligned, when asked', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 10, y: 200, width: 40, height: 20 }, bounds, 'right')).toEqual({ x: 50, y: 200 });
  });
  it('flips left when asked right with no room there', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 740, y: 200, width: 40, height: 20 }, bounds, 'right')).toEqual({ x: 640, y: 200 });
  });
  it('opens left of the rect when asked, shifted up to stay inside', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 300, y: 580, width: 40, height: 20 }, bounds, 'left')).toEqual({ x: 200, y: 550 });
  });
  it('flips right when asked left with no room there', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 40, y: 200, width: 40, height: 20 }, bounds, 'left')).toEqual({ x: 80, y: 200 });
  });
  it('stays below by default', () => {
    expect(placeMenuUnder({ width: 100, height: 50 }, { x: 10, y: 200, width: 40, height: 20 }, bounds)).toEqual({ x: 10, y: 220 });
  });
});
