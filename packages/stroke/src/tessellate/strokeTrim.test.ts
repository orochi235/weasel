import { describe, it, expect } from 'vitest';
import { tessellateStroke } from './stroke';
import { PATH_M, PATH_L, PathBuilder, type PolygonPath } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const BASE: Stroke = { paint: { kind: 'solid', color: '#000' }, width: 2 };

function spanX(mesh: { vertices: Float32Array }): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < mesh.vertices.length; i += 2) {
    lo = Math.min(lo, mesh.vertices[i]);
    hi = Math.max(hi, mesh.vertices[i]);
  }
  return [lo, hi];
}

describe('inset trimming in tessellateStroke', () => {
  it('reaches the full length with no insets', () => {
    expect(spanX(tessellateStroke(LINE, BASE))[1]).toBeCloseTo(100, 4);
  });

  it('stops short of the end by endInset', () => {
    expect(spanX(tessellateStroke(LINE, BASE, { endInset: 6 }))[1]).toBeCloseTo(94, 4);
  });

  it('starts late by startInset', () => {
    const [lo, hi] = spanX(tessellateStroke(LINE, BASE, { startInset: 6 }));
    expect(lo).toBeCloseTo(6, 4);
    expect(hi).toBeCloseTo(100, 4);
  });

  it('trims both ends at once', () => {
    const [lo, hi] = spanX(tessellateStroke(LINE, BASE, { startInset: 6, endInset: 6 }));
    expect(lo).toBeCloseTo(6, 4);
    expect(hi).toBeCloseTo(94, 4);
  });

  it('emits nothing when the insets swallow the line', () => {
    expect(tessellateStroke(LINE, BASE, { startInset: 60, endInset: 60 }).vertices.length).toBe(0);
  });

  it('trims each open subpath independently', () => {
    const two: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 40, 0, 60, 0, 100, 0]),
      fillRule: 'nonzero',
    };
    const { vertices } = tessellateStroke(two, BASE, { startInset: 5, endInset: 5 });
    const xs = new Set<number>();
    for (let i = 0; i < vertices.length; i += 2) xs.add(Math.round(vertices[i] * 1e4) / 1e4);
    expect([...xs].sort((a, b) => a - b)).toEqual([5, 35, 65, 95]);
  });

  it('dashes the trimmed line, so the pattern fits what is visible', () => {
    const dashed = { ...BASE, dash: [10, 10] };
    const plain = tessellateStroke(LINE, dashed);
    const trimmed = tessellateStroke(LINE, dashed, { endInset: 30 });
    expect(spanX(trimmed)[1]).toBeLessThan(spanX(plain)[1]);
    expect(spanX(trimmed)[1]).toBeLessThanOrEqual(70 + 1e-4);
  });
});

describe('a trimmed stroke whose widths split its corners', () => {
  const ELBOW = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
  const minY = (mesh: { vertices: Float32Array }) => {
    let lo = Infinity;
    for (let i = 1; i < mesh.vertices.length; i += 2) lo = Math.min(lo, mesh.vertices[i]);
    return lo;
  };

  it('cuts a nibbed stroke where it cuts a plain one', () => {
    const plain = tessellateStroke(ELBOW, { ...BASE, trim: { start: 0.75 } });
    const nibbed = tessellateStroke(ELBOW, { ...BASE, nib: { angle: 0.3, ratio: 0.5 }, trim: { start: 0.75 } });
    expect(minY(plain)).toBeCloseTo(5, 4);
    expect(minY(nibbed)).toBeCloseTo(5, 4);
  });

  it('cuts a closed nibbed stroke where it cuts a plain one', () => {
    const square = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).lineTo(0, 10).close().build();
    const trim = { start: 0.625, end: 0.875 };
    const nibbed = tessellateStroke(square, { ...BASE, nib: { angle: 0.3, ratio: 0.5 }, trim });
    // From (5, 10) along the top edge and down the closing one to (0, 5), each end a butt cap.
    expect(spanX(nibbed)[1]).toBeCloseTo(5, 4);
    expect(minY(nibbed)).toBeCloseTo(5, 4);
  });
});
