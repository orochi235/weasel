import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';
import { widestStrokeWidth } from './vertexWidths';

const LINE = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
const base: Stroke = { paint: { color: '#000' }, width: 4, cap: 'butt', join: 'bevel' };

/** The y extent of the mesh's vertices whose x lies in [x0, x1]. */
function yRange(v: Float32Array, x0 = -Infinity, x1 = Infinity): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < v.length; i += 2) {
    if (v[i] < x0 - 1e-6 || v[i] > x1 + 1e-6) continue;
    lo = Math.min(lo, v[i + 1]);
    hi = Math.max(hi, v[i + 1]);
  }
  return [lo, hi];
}

describe('a vertexWidths pair', () => {
  // A path running in +x has its right side at +y, below it on a y-down screen.
  it('puts each edge its own distance from the path', () => {
    const mesh = tessellateStroke(LINE, { ...base, vertexWidths: [{ left: 2, right: 6 }, { left: 2, right: 6 }] });
    const [lo, hi] = yRange(mesh.vertices);
    expect(lo).toBeCloseTo(-2, 5);
    expect(hi).toBeCloseTo(6, 5);
  });

  it('interpolates each side on its own between anchors, beside a plain number', () => {
    const mesh = tessellateStroke(LINE, { ...base, vertexWidths: [{ left: 0, right: 10 }, 4] });
    expect(yRange(mesh.vertices, 0, 0)).toEqual([expect.closeTo(0, 5), expect.closeTo(10, 5)]);
    expect(yRange(mesh.vertices, 100, 100)).toEqual([expect.closeTo(-2, 5), expect.closeTo(2, 5)]);
  });

  it('keeps its sides through a dash', () => {
    const mesh = tessellateStroke(LINE, { ...base, dash: [10, 10], vertexWidths: [{ left: 1, right: 5 }, { left: 1, right: 5 }] });
    const [lo, hi] = yRange(mesh.vertices, 40, 50);
    expect(lo).toBeCloseTo(-1, 5);
    expect(hi).toBeCloseTo(5, 5);
  });

  it('is scaled on both sides by a nib', () => {
    // Moving along a nib at angle 0 draws `ratio` of the width.
    const mesh = tessellateStroke(LINE, {
      ...base, nib: { angle: 0, ratio: 0.5 }, vertexWidths: [{ left: 2, right: 6 }, { left: 2, right: 6 }],
    });
    const [lo, hi] = yRange(mesh.vertices);
    expect(lo).toBeCloseTo(-1, 5);
    expect(hi).toBeCloseTo(3, 5);
  });

  it('caps round about the middle of the ribbon, not the path', () => {
    const mesh = tessellateStroke(LINE, { ...base, cap: 'round', vertexWidths: [{ left: 0, right: 8 }, { left: 0, right: 8 }] });
    const [lo, hi] = yRange(mesh.vertices);
    expect(lo).toBeCloseTo(0, 5);
    expect(hi).toBeCloseTo(8, 5);
    let minX = Infinity;
    for (let i = 0; i < mesh.vertices.length; i += 2) minX = Math.min(minX, mesh.vertices[i]);
    expect(minX).toBeCloseTo(-4, 1);
  });

  it('counts its wider side in the widest width', () => {
    expect(widestStrokeWidth(4, [{ left: 1, right: 9 }])).toBe(18);
  });
});
