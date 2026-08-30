import { describe, it, expect } from 'vitest';
import { tessellateStroke } from './stroke';
import { PATH_M, PATH_L, type PolygonPath } from '../../../core/geometry/path';
import type { Stroke } from '@weasel-js/paint';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const BASE: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };

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
    const [lo, hi] = spanX(tessellateStroke(two, BASE, { startInset: 5, endInset: 5 }));
    expect(lo).toBeCloseTo(5, 4);
    expect(hi).toBeCloseTo(95, 4);
  });

  it('dashes the trimmed line, so the pattern fits what is visible', () => {
    const dashed = { ...BASE, dash: [10, 10] };
    const plain = tessellateStroke(LINE, dashed);
    const trimmed = tessellateStroke(LINE, dashed, { endInset: 30 });
    expect(spanX(trimmed)[1]).toBeLessThan(spanX(plain)[1]);
    expect(spanX(trimmed)[1]).toBeLessThanOrEqual(70 + 1e-4);
  });
});
