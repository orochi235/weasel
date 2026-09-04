import { describe, expect, it } from 'vitest';
import { chromeLineWidthScale, cursorPaintMatrix, cursorPaintOps, cursorWorldSize } from './paint';
import { bakeCursor } from './bake';
import { CURSOR_HALO, CURSOR_INK } from './types';
import type { CursorGlyph } from './types';

const PENCIL: CursorGlyph = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 7.5 16.5 L 16 8 L 19 11 L 10.5 19.5 L 8 19 Z' },
    { role: 'detail', d: 'M 14 6 L 19 11', width: 1.2 },
  ],
};

const WIRE: CursorGlyph = {
  box: 24,
  hotspot: [12, 12],
  paths: [{ role: 'stroke', d: 'M 6 6 L 18 18', width: 1.6 }],
};

describe('cursorPaintOps', () => {
  it('emits every halo before any ink', () => {
    // The same rule the baker follows, for the same reason: a per-path halo
    // lets a later path's halo cut a white trench through an earlier fill.
    // Two ink members, so "all halos first" and "each path haloed in place"
    // produce different orders and the test can tell them apart.
    const two: CursorGlyph = {
      box: 24,
      hotspot: [12, 12],
      paths: [
        { role: 'ink', d: 'M 4 4 L 12 4 L 12 12 Z' },
        { role: 'ink', d: 'M 12 12 L 20 12 L 20 20 Z' },
      ],
    };
    expect(cursorPaintOps(two).map((o) => o.fill)).toEqual([
      CURSOR_HALO,
      CURSOR_HALO,
      CURSOR_INK,
      CURSOR_INK,
    ]);
  });

  it('gives a detail no halo of its own', () => {
    // A detail IS halo-coloured and sits on top of the ink.
    const details = cursorPaintOps(PENCIL).filter((o) => o.d === 'M 14 6 L 19 11');
    expect(details).toHaveLength(1);
    expect(details[0].stroke).toEqual({ color: CURSOR_HALO, width: 1.2 });
  });

  it('widens a stroke member by the halo width in the halo pass', () => {
    const widths = cursorPaintOps(WIRE).map((o) => o.stroke?.width);
    expect(widths).toEqual([4.2, 1.6]);
  });

  it('scales line weight without touching geometry', () => {
    // What a world-sized glyph needs: a ring drawn at a 400px radius must
    // still carry a chrome-weight line, not a 40px-thick one.
    const ops = cursorPaintOps(WIRE, { lineWidthScale: 0.25 });
    expect(ops.map((o) => o.stroke?.width)).toEqual([1.05, 0.4]);
    expect(ops.every((o) => o.d === 'M 6 6 L 18 18')).toBe(true);
  });
});

describe('cursorPaintOps and bakeCursor agree', () => {
  it('paints exactly the members the baker draws, in the same order', () => {
    // The claim the two-renderer design rests on. Compare the `d` sequence:
    // if one renderer grows or drops a pass the orders diverge here.
    for (const glyph of [PENCIL, WIRE]) {
      const svg = decodeURIComponent(bakeCursor(glyph, {}));
      const baked = [...svg.matchAll(/<path d="([^"]*)"/g)].map((m) => m[1]);
      expect(cursorPaintOps(glyph).map((o) => o.d)).toEqual(baked);
    }
  });
});

describe('cursorPaintMatrix', () => {
  /** Apply an affine `[a,b,c,d,e,f]` to a point, as SVG and canvas both read it. */
  const apply = (
    m: readonly [number, number, number, number, number, number],
    x: number,
    y: number,
  ): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

  it('lands the hotspot on the point the cursor is at', () => {
    const m = cursorPaintMatrix(PENCIL, { size: 24, at: { x: 100, y: 40 } });
    const [x, y] = apply(m, PENCIL.hotspot[0], PENCIL.hotspot[1]);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(40);
  });

  it('scales glyph units to CSS px by size/box', () => {
    // The box is 24 wide, so at size 48 a 1-unit step is 2 px.
    const m = cursorPaintMatrix(PENCIL, { size: 48, at: { x: 0, y: 0 } });
    const [x0, y0] = apply(m, 0, 0);
    const [x1, y1] = apply(m, 1, 0);
    expect(x1 - x0).toBeCloseTo(2);
    expect(y1 - y0).toBeCloseTo(0);
  });

  it('keeps the hotspot pinned as the glyph turns', () => {
    // Rotation is about the hotspot, which is what makes the baker's
    // "hotspot travels with the glyph" rule and this one the same rule.
    const at = { x: 60, y: 60 };
    for (const angle of [0, Math.PI / 4, Math.PI, -Math.PI / 3]) {
      const m = cursorPaintMatrix(PENCIL, { size: 24, angle, at });
      const [x, y] = apply(m, PENCIL.hotspot[0], PENCIL.hotspot[1]);
      expect(x).toBeCloseTo(60);
      expect(y).toBeCloseTo(60);
    }
  });

  it('turns clockwise on screen, the direction the baker turns', () => {
    // y is down, so a positive angle carries +x toward +y. A sign flip here
    // points every rotated cursor the wrong way while still looking rotated.
    const m = cursorPaintMatrix(WIRE, { size: 24, angle: Math.PI / 2, at: { x: 0, y: 0 } });
    const [hx, hy] = apply(m, WIRE.hotspot[0], WIRE.hotspot[1]);
    const [px, py] = apply(m, WIRE.hotspot[0] + 1, WIRE.hotspot[1]);
    expect(px - hx).toBeCloseTo(0);
    expect(py - hy).toBeCloseTo(1);
  });
});

describe('cursorWorldSize', () => {
  const RING: CursorGlyph = {
    box: 24,
    hotspot: [12, 12],
    radius: 9.9,
    paths: [{ role: 'stroke', d: 'M 12 2.1 A 9.9 9.9 0 1 0 12 21.9 A 9.9 9.9 0 1 0 12 2.1 Z', width: 1.6 }],
  };

  it('draws the named circle at the world radius it was asked for', () => {
    // The whole contract of a brush cursor: the ring measures the brush.
    for (const [worldRadius, scale] of [[40, 1], [40, 2], [7.5, 0.5]] as const) {
      const size = cursorWorldSize(RING, worldRadius, scale);
      const renderedRingRadius = (RING.radius as number) * (size / RING.box);
      expect(renderedRingRadius).toBeCloseTo(worldRadius * scale);
    }
  });

  it('falls back to the inscribed circle when a glyph names no radius', () => {
    const { radius: _unused, ...noRadius } = RING;
    expect(cursorWorldSize(noRadius, 12, 1)).toBeCloseTo(24);
  });

  it('holds line weight constant as the ring grows', () => {
    // A ring at a 400px radius drawn with a scaled weight carries a 40px
    // stroke and a halo to match — a filled blob, not a cursor.
    for (const worldRadius of [8, 200]) {
      const size = cursorWorldSize(RING, worldRadius, 1);
      const ops = cursorPaintOps(RING, { lineWidthScale: chromeLineWidthScale(RING, size) });
      const renderedWidth = (ops[1].stroke as { width: number }).width * (size / RING.box);
      expect(renderedWidth).toBeCloseTo(1.6);
    }
  });
});
