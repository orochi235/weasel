import { describe, expect, it } from 'vitest';
import { gapByMidpoint, isNoopDrop, isNudgeChord, moveItems, movedIndex, nearestGap, nudgeGap, nudgeOf } from './reorder';

const L = ['a', 'b', 'c', 'd', 'e'];

describe('moveItems', () => {
  it('moves one item forward into the gap after a later item', () => {
    expect(moveItems(L, [1], 4)).toEqual(['a', 'c', 'd', 'b', 'e']);
  });
  it('moves one item back', () => {
    expect(moveItems(L, [3], 0)).toEqual(['d', 'a', 'b', 'c', 'e']);
  });
  it('moves to the end', () => {
    expect(moveItems(L, [0], 5)).toEqual(['b', 'c', 'd', 'e', 'a']);
  });
  it('moves a contiguous run as one', () => {
    expect(moveItems(L, [1, 2], 5)).toEqual(['a', 'd', 'e', 'b', 'c']);
    expect(moveItems(L, [3, 4], 1)).toEqual(['a', 'd', 'e', 'b', 'c']);
  });
  it('gathers scattered items in their order, whatever order they are named in', () => {
    expect(moveItems(L, [4, 0, 2], 2)).toEqual(['b', 'a', 'c', 'e', 'd']);
  });
  it('leaves the list as it was for a drop beside the item', () => {
    expect(moveItems(L, [2], 2)).toEqual(L);
    expect(moveItems(L, [2], 3)).toEqual(L);
  });
});

describe('movedIndex', () => {
  it('counts out the moved items before the gap', () => {
    expect(movedIndex([1], 4)).toBe(3);
    expect(movedIndex([3], 0)).toBe(0);
    expect(movedIndex([1, 2], 5)).toBe(3);
    expect(movedIndex([0, 4], 3)).toBe(2);
  });
});

describe('isNoopDrop', () => {
  it('is true for the gaps either side of one item', () => {
    expect(isNoopDrop([2], 2)).toBe(true);
    expect(isNoopDrop([2], 3)).toBe(true);
    expect(isNoopDrop([2], 1)).toBe(false);
    expect(isNoopDrop([2], 4)).toBe(false);
  });
  it('is true at and inside a contiguous run', () => {
    expect(isNoopDrop([1, 2, 3], 1)).toBe(true);
    expect(isNoopDrop([3, 1, 2], 3)).toBe(true);
    expect(isNoopDrop([1, 2, 3], 4)).toBe(true);
    expect(isNoopDrop([1, 2, 3], 5)).toBe(false);
  });
  it('is false for scattered items and for none', () => {
    expect(isNoopDrop([1, 3], 2)).toBe(false);
    expect(isNoopDrop([], 0)).toBe(false);
  });
});

describe('nudgeGap', () => {
  it('steps one place either way', () => {
    expect(nudgeGap([2], -1, 5)).toBe(1);
    expect(nudgeGap([2], 1, 5)).toBe(4);
    expect(nudgeGap([1, 2], 1, 5)).toBe(4);
  });
  it('is null at either end', () => {
    expect(nudgeGap([0], -1, 5)).toBeNull();
    expect(nudgeGap([4], 1, 5)).toBeNull();
    expect(nudgeGap([3, 4], 1, 5)).toBeNull();
    expect(nudgeGap([], 1, 5)).toBeNull();
  });
  it('lands where moveItems puts the item one place along', () => {
    expect(moveItems(L, [2], nudgeGap([2], 1, 5)!)).toEqual(['a', 'b', 'd', 'c', 'e']);
    expect(moveItems(L, [2], nudgeGap([2], -1, 5)!)).toEqual(['a', 'c', 'b', 'd', 'e']);
  });
});

describe('gapByMidpoint', () => {
  const mids = [10, 30, 50];
  it('splits each item at its middle', () => {
    expect(gapByMidpoint(mids, 0)).toBe(0);
    expect(gapByMidpoint(mids, 9)).toBe(0);
    expect(gapByMidpoint(mids, 10)).toBe(1);
    expect(gapByMidpoint(mids, 29)).toBe(1);
    expect(gapByMidpoint(mids, 51)).toBe(3);
  });
  it('counts the other way along a line that runs backward', () => {
    expect(gapByMidpoint([50, 30, 10], 55)).toBe(0);
    expect(gapByMidpoint([50, 30, 10], 40)).toBe(1);
    expect(gapByMidpoint([50, 30, 10], 0)).toBe(3);
  });
  it('is 0 for no items', () => {
    expect(gapByMidpoint([], 5)).toBe(0);
  });
});

describe('nearestGap', () => {
  it('picks the nearest gap, the first of a tie', () => {
    expect(nearestGap([0, 20, 60], 35)).toBe(1);
    expect(nearestGap([0, 20, 60], 45)).toBe(2);
    expect(nearestGap([0, 20], 10)).toBe(0);
    expect(nearestGap([], 10)).toBe(-1);
  });
});

describe('nudgeOf', () => {
  const k = (key: string, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) =>
    ({ key, altKey: false, ctrlKey: false, metaKey: false, ...mods });
  it('reads Alt+Up and Alt+Down', () => {
    expect(nudgeOf(k('ArrowUp', { altKey: true }))).toBe(-1);
    expect(nudgeOf(k('ArrowDown', { altKey: true }))).toBe(1);
    expect(nudgeOf(k('ArrowDown'))).toBeNull();
    expect(nudgeOf(k('ArrowRight', { altKey: true }), 'ArrowLeft', 'ArrowRight')).toBe(1);
  });
  it('is not the chord with Ctrl or Cmd held', () => {
    expect(isNudgeChord(k('ArrowUp', { altKey: true, metaKey: true }))).toBe(false);
    expect(nudgeOf(k('ArrowUp', { altKey: true, ctrlKey: true }))).toBeNull();
  });
});
