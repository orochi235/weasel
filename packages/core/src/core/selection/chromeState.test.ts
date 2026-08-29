import { describe, expect, it } from 'vitest';
import { buildChromeState } from './chromeState';
import { asNodeId } from '../scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

describe('buildChromeState', () => {
  it('exposes selection ids and modifiers as-is', () => {
    const sel = [asNodeId('a'), asNodeId('b')];
    const state = buildChromeState({
      selection: sel,
      multiActive: true,
      effectiveBoundsOf: () => null,
      modifiers: NO_MOD,
    });
    expect(state.selection).toBe(sel);
    expect(state.modifiers).toBe(NO_MOD);
    expect(state.multiActive).toBe(true);
  });

  it('boundsOf delegates to effectiveBoundsOf', () => {
    const fn = (id: string) => ({ x: id.length, y: 0, width: 1, height: 1 });
    const state = buildChromeState({
      selection: [],
      multiActive: false,
      effectiveBoundsOf: fn,
      modifiers: NO_MOD,
    });
    expect(state.boundsOf('xyz')).toEqual({ x: 3, y: 0, width: 1, height: 1 });
  });

  it('unionBounds is null when multiActive is false', () => {
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: false,
      effectiveBoundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toBeNull();
  });

  it('unionBounds is null when no selected id has computable bounds', () => {
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      effectiveBoundsOf: () => null,
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toBeNull();
  });

  it('unionBounds spans all computable members', () => {
    const map: Record<string, { x: number; y: number; width: number; height: number }> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 100, y: 50, width: 20, height: 30 },
    };
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      effectiveBoundsOf: (id) => map[id] ?? null,
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toEqual({ x: 0, y: 0, width: 120, height: 80 });
  });

  it('unionBounds skips ids with null bounds and reports the rest', () => {
    const map: Record<string, { x: number; y: number; width: number; height: number } | null> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: null,
      c: { x: 50, y: 50, width: 10, height: 10 },
    };
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b'), asNodeId('c')],
      multiActive: true,
      effectiveBoundsOf: (id) => map[id] ?? null,
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toEqual({ x: 0, y: 0, width: 60, height: 60 });
  });

  it('unionBounds is computed lazily and cached', () => {
    let calls = 0;
    const state = buildChromeState({
      selection: [asNodeId('a')],
      multiActive: true,
      effectiveBoundsOf: () => {
        calls++;
        return { x: 0, y: 0, width: 1, height: 1 };
      },
      modifiers: NO_MOD,
    });
    // Not consulted until unionBounds is accessed.
    expect(calls).toBe(0);
    void state.unionBounds;
    expect(calls).toBe(1);
    // Cached on subsequent accesses.
    void state.unionBounds;
    expect(calls).toBe(1);
  });

  it('unionBounds covers a rotated member\'s ink, not its unrotated box', () => {
    // The frame and its handles are painted from this box and hit-tested
    // against it, so an under-reported union puts both inside the shape.
    const boxes: Record<string, { x: number; y: number; width: number; height: number; rotation?: number }> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 },
    };
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      effectiveBoundsOf: (id) => boxes[id] ?? null,
      modifiers: NO_MOD,
    });
    // b spans y -15..25 once rotated; the union must reach both extremes.
    expect(state.unionBounds!.y).toBeCloseTo(-15);
    expect(state.unionBounds!.y + state.unionBounds!.height).toBeCloseTo(25);
  });
});
