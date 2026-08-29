/**
 * Tests for `enumerateAnchors` + `withCoord`. The enumerator is the
 * load-bearing primitive behind the bezier-edit overlay; misclassifying
 * adjacent C/Q controls or missing a subpath boundary silently corrupts
 * what the user sees as draggable handles.
 */
import { describe, it, expect } from 'vitest';
import { enumerateAnchors, withCoord } from './geometry';
import {
  PATH_M,
  PATH_L,
  PATH_C,
  PATH_Q,
  PATH_Z,
  type PolygonPath,
} from 'features/paths/types';

const path = (commands: number[], coords: number[]): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array(commands),
  coords: new Float32Array(coords),
  fillRule: 'nonzero',
});

describe('enumerateAnchors', () => {
  it('yields one anchor per M/L vertex on an open polyline', () => {
    const p = path([PATH_M, PATH_L, PATH_L], [0, 0, 10, 0, 10, 10]);
    const a = enumerateAnchors(p);
    expect(a.map((x) => [x.x, x.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(a.every((x) => x.controlIn === undefined && x.controlOut === undefined)).toBe(true);
  });

  it('attaches C controls as controlOut on the previous anchor + controlIn on the new one', () => {
    // M(0,0) C(1,5) (4,5) (5,0)   — one anchor at (0,0), one at (5,0).
    const p = path([PATH_M, PATH_C], [0, 0, 1, 5, 4, 5, 5, 0]);
    const a = enumerateAnchors(p);
    expect(a).toHaveLength(2);
    // Anchor 0 (start): no controlIn (no prior segment); controlOut = C's first control.
    expect(a[0].controlIn).toBeUndefined();
    expect(a[0].controlOut).toEqual({ x: 1, y: 5, coordIndex: 2 });
    // Anchor 1 (end of curve): controlIn = C's second control; no controlOut yet.
    expect(a[1].x).toBe(5);
    expect(a[1].y).toBe(0);
    expect(a[1].controlIn).toEqual({ x: 4, y: 5, coordIndex: 4 });
    expect(a[1].controlOut).toBeUndefined();
  });

  it('attaches Q controls correctly (single control acts as both)', () => {
    // M(0,0) Q(5,10) (10,0)
    const p = path([PATH_M, PATH_Q], [0, 0, 5, 10, 10, 0]);
    const a = enumerateAnchors(p);
    expect(a).toHaveLength(2);
    expect(a[0].controlOut).toEqual({ x: 5, y: 10, coordIndex: 2 });
    expect(a[1].controlIn).toEqual({ x: 5, y: 10, coordIndex: 2 });
    expect(a[1].x).toBe(10);
    expect(a[1].y).toBe(0);
  });

  it('Z ends a subpath — a new M after Z does NOT inherit controlIn', () => {
    // Subpath 1: M(0,0) L(10,0) Z. Subpath 2: M(20,20) L(30,20).
    const p = path(
      [PATH_M, PATH_L, PATH_Z, PATH_M, PATH_L],
      [0, 0, 10, 0, 20, 20, 30, 20],
    );
    const a = enumerateAnchors(p);
    expect(a).toHaveLength(4);
    // The fresh M in subpath 2 must NOT have a controlIn carried over.
    expect(a[2].x).toBe(20);
    expect(a[2].y).toBe(20);
    expect(a[2].controlIn).toBeUndefined();
  });

  it('anchorIndex is 0-based walk order across multi-contour paths', () => {
    const p = path(
      [PATH_M, PATH_L, PATH_Z, PATH_M, PATH_L],
      [0, 0, 1, 0, 2, 2, 3, 2],
    );
    const a = enumerateAnchors(p);
    expect(a.map((x) => x.anchorIndex)).toEqual([0, 1, 2, 3]);
  });

  it('records correct coordIndex pointing at the on-curve x in the float buffer', () => {
    // M(0,0) at coord 0, L(10,0) at coord 2, C controls at 4..7, anchor at 8.
    const p = path([PATH_M, PATH_L, PATH_C], [0, 0, 10, 0, 11, 5, 14, 5, 15, 0]);
    const a = enumerateAnchors(p);
    expect(a[0].coordIndex).toBe(0);
    expect(a[1].coordIndex).toBe(2);
    expect(a[2].coordIndex).toBe(8);
    // controlIn of anchor 2 sits at coord 6 (the second cubic control).
    expect(a[2].controlIn?.coordIndex).toBe(6);
    // controlOut of anchor 1 sits at coord 4 (the first cubic control).
    expect(a[1].controlOut?.coordIndex).toBe(4);
  });

  it('emits no anchors for an empty path', () => {
    const p = path([], []);
    expect(enumerateAnchors(p)).toEqual([]);
  });
});

describe('withCoord', () => {
  it('returns a new path with the coord updated; original buffer unchanged', () => {
    const p = path([PATH_M, PATH_L], [0, 0, 10, 0]);
    const next = withCoord(p, 2, 99, 88);
    // Updated copy.
    expect(Array.from(next.coords)).toEqual([0, 0, 99, 88]);
    // Original untouched.
    expect(Array.from(p.coords)).toEqual([0, 0, 10, 0]);
    // Commands buffer is shared by reference (cheap; immutable contract).
    expect(next.commands).toBe(p.commands);
    expect(next.fillRule).toBe('nonzero');
  });

  it('preserves fillRule from input', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0]),
      fillRule: 'evenodd',
    };
    const next = withCoord(p, 0, 1, 2);
    expect(next.fillRule).toBe('evenodd');
  });
});

describe('enumerateAnchors unknown commands', () => {
  it('throws rather than misreading the coord stream', () => {
    const p = path([PATH_M, 99, PATH_L], [0, 0, 10, 0, 10, 10]);
    expect(() => enumerateAnchors(p)).toThrow(/enumerateAnchors: unknown command 99/);
  });
});
