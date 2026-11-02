import { describe, it, expect } from 'vitest';
import { tessellateStroke } from './stroke';
import { PATH_M, PATH_L, type Path, type PolygonPath } from '@weasel-js/geom';
import { MAX_DASH_RUNS, type Stroke } from '@weasel-js/paint';
import { strokeInsets } from '../markerInset';
import { strokeSpaceOf } from './metric';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const BASE: Stroke = { paint: { kind: 'solid', color: '#000' }, width: 2, cap: 'butt' };

function spanX(mesh: { vertices: Float32Array }): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < mesh.vertices.length; i += 2) {
    lo = Math.min(lo, mesh.vertices[i]);
    hi = Math.max(hi, mesh.vertices[i]);
  }
  return [lo, hi];
}

/** The x spans of a mesh's disjoint pieces along a horizontal line, in order. */
function pieces(mesh: { vertices: Float32Array }): [number, number][] {
  const xs = [...new Set(Array.from({ length: mesh.vertices.length / 2 }, (_v, i) => Math.round(mesh.vertices[i * 2] * 1e4) / 1e4))]
    .sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

describe('tessellateStroke under a trim', () => {
  it('draws only the window', () => {
    const [lo, hi] = spanX(tessellateStroke(LINE, { ...BASE, trim: { end: 0.5 } }));
    expect(lo).toBeCloseTo(0, 4);
    expect(hi).toBeCloseTo(50, 4);
  });

  it('trims before marker insets', () => {
    const stroke: Stroke = { ...BASE, markerEnd: 'arrow', trim: { end: 0.5 } };
    const inset = strokeInsets(stroke, 2).end;
    expect(inset).toBeGreaterThan(0);
    expect(spanX(tessellateStroke(LINE, stroke, { endInset: inset }))[1]).toBeCloseTo(50 - inset, 4);
  });

  it('empty window draws nothing', () => {
    expect(tessellateStroke(LINE, { ...BASE, trim: { start: 0.7, end: 0.2 } }).vertices.length).toBe(0);
  });

  it('dash stays anchored to the subpath start', () => {
    // [10, 10] from x 0 puts x 15 inside the gap 10–20, so the first dash is 20–30.
    const runs = pieces(tessellateStroke(LINE, { ...BASE, dash: [10, 10], trim: { start: 0.15 } }));
    expect(runs[0][0]).toBeCloseTo(20, 4);
    expect(runs[0][1]).toBeCloseTo(30, 4);
    const mid = pieces(tessellateStroke(LINE, { ...BASE, dash: [10, 10], trim: { start: 0.25 } }));
    expect(mid[0]).toEqual([25, 30]);
  });

  it('dash solid decision ignores trim', () => {
    // Over the whole 100 units this pattern needs 125 000 runs, past the cap; over half it would need 62 500.
    const p = (100 / MAX_DASH_RUNS) * 0.8;
    const solid = tessellateStroke(LINE, { ...BASE, dash: [p, p] });
    expect(solid.vertices.length / 2).toBe(4);
    const trimmed = tessellateStroke(LINE, { ...BASE, dash: [p, p], trim: { end: 0.5 } });
    expect(trimmed.vertices.length / 2).toBe(4);
    expect(spanX(trimmed)[1]).toBeCloseTo(50, 4);
  });

  it('rect under a stretching metric trims in world length', () => {
    const { metric } = strokeSpaceOf(4, 0, 0, 1);
    const rect: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    // A quarter of the 300-unit world perimeter is 75 along the top edge; measured in
    // the metric's space (top 200, side 25) a quarter would stop at x 56.25.
    const mesh = tessellateStroke(rect, { ...BASE, width: 0.1, trim: { end: 0.25 } }, { metric: metric! });
    const [lo, hi] = spanX(mesh);
    expect(lo).toBeCloseTo(0, 3);
    expect(hi).toBeCloseTo(75, 3);
  });
});
