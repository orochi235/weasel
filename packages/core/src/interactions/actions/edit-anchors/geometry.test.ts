/**
 * Tests for `enumerateAnchors` + `withCoord`. The enumerator is the
 * load-bearing primitive behind the anchor-edit overlay; misclassifying
 * adjacent C/Q controls or missing a subpath boundary silently corrupts
 * what the user sees as draggable handles.
 */
import { describe, it, expect } from 'vitest';
import { enumerateAnchors, translateAnchor, withCoord } from './geometry';
import {
  PATH_M,
  PATH_L,
  PATH_C,
  PATH_Q,
  PATH_Z,
  PathBuilder,
  worldCoords,
  type PolygonPath,
} from '@weasel-js/geom';

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

describe('a closed subpath whose last curve returns to its start', () => {
  // M 0,0  C 4,-6 16,-6 20,0  C 24,6 -4,6 0,0  Z  M 50,50  L 60,50
  const loop = path(
    [PATH_M, PATH_C, PATH_C, PATH_Z, PATH_M, PATH_L],
    [0, 0, 4, -6, 16, -6, 20, 0, 24, 6, -4, 6, 0, 0, 50, 50, 60, 50],
  );

  it('is one anchor at the seam, holding both controls', () => {
    const anchors = enumerateAnchors(loop);
    expect(anchors.map((a) => [a.x, a.y])).toEqual([[0, 0], [20, 0], [50, 50], [60, 50]]);
    expect(anchors.map((a) => a.anchorIndex)).toEqual([0, 1, 2, 3]);
    expect(anchors[0].controlOut).toEqual({ x: 4, y: -6, coordIndex: 2 });
    expect(anchors[0].controlIn).toEqual({ x: -4, y: 6, coordIndex: 10 });
    expect(anchors[0].closeCoordIndex).toBe(12);
  });

  it('moves both copies of the seam point with the anchor', () => {
    const moved = translateAnchor(loop, 0, 3, 5);
    expect(Array.from(moved.coords)).toEqual(
      [3, 5, 7, -1, 16, -6, 20, 0, 24, 6, -1, 11, 3, 5, 50, 50, 60, 50],
    );
  });

  it('keeps a closing curve that stops short of the start as its own anchor', () => {
    const short = path([PATH_M, PATH_L, PATH_C, PATH_Z], [0, 0, 10, 0, 10, 5, 1, 5, 1, 0]);
    expect(enumerateAnchors(short)).toHaveLength(3);
  });
});

describe('a path measured from an origin', () => {
  const FAR = 262_144;
  const far = new PathBuilder().setOrigin(FAR, 0).moveTo(FAR + 0.3, 1).lineTo(FAR + 1.3, 1).lineTo(FAR + 1.3, 2).build();

  it('enumerates anchors in the path\'s own space and writes a moved one back from its origin', () => {
    const anchors = enumerateAnchors(far);
    expect(anchors[1].x).toBeCloseTo(FAR + 1.3, 6);
    const moved = withCoord(far, anchors[1].coordIndex, FAR + 1.8, 1);
    expect(moved.origin).toEqual(far.origin);
    expect(worldCoords(moved)[2]).toBeCloseTo(FAR + 1.8, 6);
  });
});
