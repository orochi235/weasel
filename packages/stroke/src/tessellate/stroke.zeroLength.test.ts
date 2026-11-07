import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { tessellateStroke } from './stroke';

const ink = { paint: { color: '#000' }, width: 4 } satisfies Stroke;

function extent(vertices: Float32Array): { x0: number; y0: number; x1: number; y1: number } {
  const e = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < vertices.length; i += 2) {
    e.x0 = Math.min(e.x0, vertices[i]); e.x1 = Math.max(e.x1, vertices[i]);
    e.y0 = Math.min(e.y0, vertices[i + 1]); e.y1 = Math.max(e.y1, vertices[i + 1]);
  }
  return e;
}

describe('tessellateStroke on zero-length runs', () => {
  it('draws a round-capped zero-length subpath as a disc', () => {
    const mesh = tessellateStroke(pathFromD('M5 5L5 5'), { ...ink, cap: 'round' });
    expect(mesh.indices.length).toBeGreaterThan(0);
    const e = extent(mesh.vertices);
    expect([e.x0, e.y0, e.x1, e.y1].map((v) => +v.toFixed(5))).toEqual([3, 3, 7, 7]);
  });

  it('draws a square-capped zero-length subpath as a square on the x axis', () => {
    const e = extent(tessellateStroke(pathFromD('M5 5L5 5'), { ...ink, cap: 'square' }).vertices);
    expect([e.x0, e.y0, e.x1, e.y1]).toEqual([3, 3, 7, 7]);
  });

  it('draws nothing for a butt-capped one, nor for a lone moveto', () => {
    expect(tessellateStroke(pathFromD('M5 5L5 5'), { ...ink, cap: 'butt' }).indices.length).toBe(0);
    expect(tessellateStroke(pathFromD('M5 5'), { ...ink, cap: 'round' }).indices.length).toBe(0);
  });

  it('draws a dot for each zero-length dash of a round-capped line', () => {
    const mesh = tessellateStroke(pathFromD('M0 0L45 0'), { ...ink, cap: 'round', dash: [0, 10] });
    // Dots at 0, 10, 20, 30 and 40.
    const e = extent(mesh.vertices);
    expect([e.x0, e.x1].map((v) => +v.toFixed(5))).toEqual([-2, 42]);
    const dots = new Set<number>();
    for (let i = 0; i < mesh.vertices.length; i += 2) dots.add(Math.round(mesh.vertices[i] / 10));
    expect([...dots].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it("turns a zero-length dash's square cap along the line", () => {
    const mesh = tessellateStroke(pathFromD('M0 0L30 30'), { ...ink, cap: 'square', dash: [0, 100] });
    // One square at the origin, turned 45°: its corners on the axes, 2√2 out.
    const e = extent(mesh.vertices);
    expect(e.x1).toBeCloseTo(2 * Math.SQRT2, 5);
    expect(e.y1).toBeCloseTo(2 * Math.SQRT2, 5);
  });
});
