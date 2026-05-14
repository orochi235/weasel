import { describe, expect, it } from 'vitest';
import {
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  moveToIndex,
  canBringForward,
  canSendBackward,
} from './algorithms';

describe('bringForward', () => {
  it('moves a single id up one slot', () => {
    expect(bringForward(['a', 'b', 'c', 'd'], ['b'])).toEqual(['a', 'c', 'b', 'd']);
  });

  it('no-op when id is already top', () => {
    expect(bringForward(['a', 'b', 'c'], ['c'])).toEqual(['a', 'b', 'c']);
  });

  it('multi-id preserves relative order, bubbles each up one', () => {
    expect(bringForward(['a', 'b', 'c', 'd', 'e'], ['b', 'd'])).toEqual(['a', 'c', 'b', 'e', 'd']);
  });

  it('multi-id at top: top id stays, lower ones still bubble', () => {
    expect(bringForward(['a', 'b', 'c'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(bringForward(['a', 'b', 'c', 'd'], ['c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
    expect(bringForward(['a', 'b', 'c', 'd'], ['b', 'd'])).toEqual(['a', 'c', 'b', 'd']);
  });

  it('skips ids that are not in the list', () => {
    expect(bringForward(['a', 'b', 'c'], ['x', 'b'])).toEqual(['a', 'c', 'b']);
  });
});

describe('sendBackward', () => {
  it('moves a single id down one slot', () => {
    expect(sendBackward(['a', 'b', 'c', 'd'], ['c'])).toEqual(['a', 'c', 'b', 'd']);
  });

  it('no-op when id is already bottom', () => {
    expect(sendBackward(['a', 'b', 'c'], ['a'])).toEqual(['a', 'b', 'c']);
  });

  it('multi-id preserves relative order, drops each down one', () => {
    expect(sendBackward(['a', 'b', 'c', 'd', 'e'], ['b', 'd'])).toEqual(['b', 'a', 'd', 'c', 'e']);
  });
});

describe('bringToFront', () => {
  it('moves a single id to the end (top)', () => {
    expect(bringToFront(['a', 'b', 'c', 'd'], ['b'])).toEqual(['a', 'c', 'd', 'b']);
  });

  it('multi-id lands contiguously at the end, preserves relative order', () => {
    expect(bringToFront(['a', 'b', 'c', 'd', 'e'], ['b', 'd'])).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('skips ids not in the list', () => {
    expect(bringToFront(['a', 'b'], ['x'])).toEqual(['a', 'b']);
  });
});

describe('sendToBack', () => {
  it('moves a single id to the start (bottom)', () => {
    expect(sendToBack(['a', 'b', 'c', 'd'], ['c'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('multi-id lands contiguously at the start, preserves relative order', () => {
    expect(sendToBack(['a', 'b', 'c', 'd', 'e'], ['b', 'd'])).toEqual(['b', 'd', 'a', 'c', 'e']);
  });
});

describe('canBringForward', () => {
  it('false on an empty selection', () => {
    expect(canBringForward(['a', 'b', 'c'], [])).toBe(false);
  });

  it('false when the single id is at the top', () => {
    expect(canBringForward(['a', 'b', 'c'], ['c'])).toBe(false);
  });

  it('true when the single id has room to move up', () => {
    expect(canBringForward(['a', 'b', 'c'], ['a'])).toBe(true);
    expect(canBringForward(['a', 'b', 'c'], ['b'])).toBe(true);
  });

  it('false when the multi-id selection is a contiguous block at the top', () => {
    expect(canBringForward(['a', 'b', 'c'], ['b', 'c'])).toBe(false);
    expect(canBringForward(['a', 'b', 'c', 'd'], ['c', 'd'])).toBe(false);
  });

  it('true when at least one selected id has a non-moving id above it', () => {
    expect(canBringForward(['a', 'b', 'c', 'd'], ['b', 'd'])).toBe(true);
  });

  it('false on a single-element list', () => {
    expect(canBringForward(['a'], ['a'])).toBe(false);
  });

  it('ignores ids not present in list', () => {
    expect(canBringForward(['a', 'b'], ['x'])).toBe(false);
  });
});

describe('canSendBackward', () => {
  it('false on an empty selection', () => {
    expect(canSendBackward(['a', 'b', 'c'], [])).toBe(false);
  });

  it('false when the single id is at the bottom', () => {
    expect(canSendBackward(['a', 'b', 'c'], ['a'])).toBe(false);
  });

  it('true when the single id has room to move down', () => {
    expect(canSendBackward(['a', 'b', 'c'], ['c'])).toBe(true);
    expect(canSendBackward(['a', 'b', 'c'], ['b'])).toBe(true);
  });

  it('false when the multi-id selection is a contiguous block at the bottom', () => {
    expect(canSendBackward(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
    expect(canSendBackward(['a', 'b', 'c', 'd'], ['a', 'b'])).toBe(false);
  });

  it('true when at least one selected id has a non-moving id below it', () => {
    expect(canSendBackward(['a', 'b', 'c', 'd'], ['a', 'c'])).toBe(true);
  });

  it('false on a single-element list', () => {
    expect(canSendBackward(['a'], ['a'])).toBe(false);
  });
});

describe('moveToIndex', () => {
  it('places ids contiguously starting at index, preserves relative order', () => {
    expect(moveToIndex(['a', 'b', 'c', 'd', 'e'], ['a', 'd'], 2)).toEqual(['b', 'c', 'a', 'd', 'e']);
  });

  it('clamps index to valid range', () => {
    expect(moveToIndex(['a', 'b', 'c'], ['a'], 99)).toEqual(['b', 'c', 'a']);
    expect(moveToIndex(['a', 'b', 'c'], ['c'], -5)).toEqual(['c', 'a', 'b']);
  });

  it('skips ids not in the list', () => {
    expect(moveToIndex(['a', 'b', 'c'], ['x', 'a'], 1)).toEqual(['b', 'a', 'c']);
  });
});
