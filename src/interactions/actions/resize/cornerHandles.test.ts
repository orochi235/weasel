import { describe, expect, it } from 'vitest';
import {
  CORNER_ANCHORS,
  cornerPoint,
  cornerResizeHandles,
  fixedCornerOf,
  hitCornerHandle,
} from './cornerHandles';

describe('cornerResizeHandles', () => {
  it('returns 4 handles at the bounds corners with opposite-corner anchors', () => {
    expect(cornerResizeHandles({ x: 10, y: 20, width: 30, height: 40 })).toEqual([
      { cx: 10, cy: 20, anchor: { x: 'max', y: 'max' } },
      { cx: 40, cy: 20, anchor: { x: 'min', y: 'max' } },
      { cx: 10, cy: 60, anchor: { x: 'max', y: 'min' } },
      { cx: 40, cy: 60, anchor: { x: 'min', y: 'min' } },
    ]);
  });
});

describe('hitCornerHandle', () => {
  const h = { cx: 100, cy: 100, anchor: { x: 'min' as const, y: 'min' as const } };

  it('hits within radius on both axes', () => {
    expect(hitCornerHandle(h, 100, 100, 4)).toBe(true);
    expect(hitCornerHandle(h, 104, 96, 4)).toBe(true);
  });

  it('misses outside radius on either axis', () => {
    expect(hitCornerHandle(h, 105, 100, 4)).toBe(false);
    expect(hitCornerHandle(h, 100, 95, 4)).toBe(false);
  });
});

describe('fixedCornerOf', () => {
  const b = { x: 10, y: 20, width: 30, height: 40 };
  // b corners: TL=(10,20), TR=(40,20), BL=(10,60), BR=(40,60)

  it('anchor min/min (left+top edges fixed, drag bottom-right): fixed corner is top-left', () => {
    expect(fixedCornerOf(b, { x: 'min', y: 'min' })).toEqual({ x: 10, y: 20 });
  });

  it('anchor min/max (left+bottom edges fixed, drag top-right): fixed corner is bottom-left', () => {
    expect(fixedCornerOf(b, { x: 'min', y: 'max' })).toEqual({ x: 10, y: 60 });
  });

  it('anchor max/min (right+top edges fixed, drag bottom-left): fixed corner is top-right', () => {
    expect(fixedCornerOf(b, { x: 'max', y: 'min' })).toEqual({ x: 40, y: 20 });
  });

  it('anchor max/max (right+bottom edges fixed, drag top-left): fixed corner is bottom-right', () => {
    expect(fixedCornerOf(b, { x: 'max', y: 'max' })).toEqual({ x: 40, y: 60 });
  });

  it('anchor free axis: fixed coord is the bounds origin on that axis', () => {
    expect(fixedCornerOf(b, { x: 'free', y: 'min' })).toEqual({ x: 10, y: 20 });
  });
});

describe('CORNER_ANCHORS round-trip', () => {
  it('decodes to the same handles as cornerResizeHandles', () => {
    const b = { x: 10, y: 20, width: 30, height: 40 };
    expect(
      CORNER_ANCHORS.map((c) => {
        const p = cornerPoint(b, c);
        return { cx: p.x, cy: p.y, anchor: c.anchor };
      }),
    ).toEqual(cornerResizeHandles(b));
  });

  it('each corner is diagonally opposite its fixed (anchor) corner', () => {
    const b = { x: 10, y: 20, width: 30, height: 40 };
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    for (const c of CORNER_ANCHORS) {
      const dragged = cornerPoint(b, c);
      const fixed = fixedCornerOf(b, c.anchor);
      // The dragged corner and its fixed opposite are reflections through
      // the AABB center: midpoint == center.
      expect((dragged.x + fixed.x) / 2).toBeCloseTo(cx);
      expect((dragged.y + fixed.y) / 2).toBeCloseTo(cy);
    }
  });

  it('corner encode/decode round-trips on a rotated pose (pin-the-opposite-corner invariant)', () => {
    // Rotate each corner + its fixed opposite around the AABB center, the
    // same way affordanceAt.cornersFor places handles for a rotated pose.
    // The world-space fixed corner derived two ways must agree:
    //   (a) rotate the unrotated fixed corner, and
    //   (b) reflect the rotated dragged corner through the rotated center.
    // (b) only equals (a) if the table's corner→anchor decode is consistent.
    const b = { x: 10, y: 20, width: 30, height: 40 };
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const theta = Math.PI / 5; // arbitrary non-trivial angle
    const rot = (px: number, py: number) => {
      const dx = px - cx;
      const dy = py - cy;
      return {
        x: cx + dx * Math.cos(theta) - dy * Math.sin(theta),
        y: cy + dx * Math.sin(theta) + dy * Math.cos(theta),
      };
    };
    // Independent ground truth (NOT derived from the table): the concrete
    // unrotated dragged corner and its diagonal fixed corner per handle kind.
    // Asserting these concrete points (post-rotation) pins each corner→anchor
    // pairing — a TL/BR (or TR/BL) swap, which the center-midpoint property
    // alone cannot catch since both lie center-symmetric on the same diagonal.
    const EXPECT: Record<string, { dragged: [number, number]; fixed: [number, number] }> = {
      'handle:top-left':     { dragged: [10, 20], fixed: [40, 60] },
      'handle:top-right':    { dragged: [40, 20], fixed: [10, 60] },
      'handle:bottom-left':  { dragged: [10, 60], fixed: [40, 20] },
      'handle:bottom-right': { dragged: [40, 60], fixed: [10, 20] },
    };
    for (const c of CORNER_ANCHORS) {
      const draggedW = rot(cornerPoint(b, c).x, cornerPoint(b, c).y);
      const fixedW = rot(fixedCornerOf(b, c.anchor).x, fixedCornerOf(b, c.anchor).y);
      const exp = EXPECT[c.kind];
      const expDragged = rot(exp.dragged[0], exp.dragged[1]);
      const expFixed = rot(exp.fixed[0], exp.fixed[1]);
      // Decoded corner + its anchor's fixed corner match the concrete expected
      // corners (rotated about center) — pins the specific corner, not just the
      // diagonal. Also implies the center-reflection invariant.
      expect(draggedW.x).toBeCloseTo(expDragged.x);
      expect(draggedW.y).toBeCloseTo(expDragged.y);
      expect(fixedW.x).toBeCloseTo(expFixed.x);
      expect(fixedW.y).toBeCloseTo(expFixed.y);
    }
  });
});
