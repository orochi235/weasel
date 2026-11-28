import { describe, expect, it } from 'vitest';
import type { Action } from '../actions/action';
import { createInFlightGestures, isEmptyOngoingHandle } from './inFlightGestures';

const action = { id: 'a', label: 'a', activeCursor: 'grabbing' } as unknown as Action;

describe('the in-flight cursor', () => {
  it("is the handle's own cursor, read each time it is asked", () => {
    const g = createInFlightGestures();
    let spec = 'move';
    g.open('g1', { cursor: () => spec }, null, action);
    expect(g.cursor()).toBe('move');
    spec = 'crosshair';
    expect(g.cursor()).toBe('crosshair');
  });

  it("falls back to the action's when the handle has none to give", () => {
    const g = createInFlightGestures();
    g.open('g1', { cursor: () => undefined }, null, action);
    expect(g.cursor()).toBe('grabbing');
  });
});

describe('isEmptyOngoingHandle', () => {
  it('is true only for a handle with nothing the dispatcher or canvas reads', () => {
    expect(isEmptyOngoingHandle({})).toBe(true);
    expect(isEmptyOngoingHandle({ autoPan: true })).toBe(true);
  });

  it.each([
    ['onWheel', { onWheel: () => true }],
    ['cursor', { cursor: () => 'ew-resize' }],
    ['subscribe', { subscribe: () => () => {} }],
    ['previewData', { previewData: () => null }],
    ['previewOpaqueIds', { previewOpaqueIds: () => null }],
    ['kind', { kind: 'scrub' }],
  ])('counts a handle with only %s as engaged', (_name, handle) => {
    expect(isEmptyOngoingHandle(handle)).toBe(false);
  });
});
