import { describe, expect, it } from 'vitest';
import { PathBuilder } from '../paths/builder';
import type { Point } from '../paths/cubicMath';
import { addSymmetric, factorSymmetric, symmetricRows } from './profileCholesky';
import { createArapSolver } from './arap';
import { puppetMesh } from './puppetMesh';
import { puppetMap, puppetSolve, unwarpPoint } from './puppet';

const close = (p: Point, q: Point, digits = 6) => {
  expect(p.x).toBeCloseTo(q.x, digits);
  expect(p.y).toBeCloseTo(q.y, digits);
};

const square = (s = 100) => new PathBuilder().moveTo(0, 0).lineTo(s, 0).lineTo(s, s).lineTo(0, s).close().build();

/** A U: two 20-wide limbs 100 tall, joined by a base 20 tall, with `gap` between them. */
function horseshoe(gap: number) {
  const w = 20, h = 100;
  const r = 2 * w + gap;
  return new PathBuilder()
    .moveTo(0, 0).lineTo(w, 0).lineTo(w, h - w).lineTo(w + gap, h - w).lineTo(w + gap, 0)
    .lineTo(r, 0).lineTo(r, h).lineTo(0, h).close().build();
}

describe('factorSymmetric', () => {
  it('solves a banded positive-definite system', () => {
    const n = 7;
    const rows = symmetricRows(n);
    for (let i = 0; i < n; i++) {
      addSymmetric(rows, i, i, 4);
      if (i > 0) addSymmetric(rows, i, i - 1, -1);
      if (i > 2) addSymmetric(rows, i, i - 3, 0.5);
    }
    const x = Float64Array.from({ length: n }, (_, i) => i - 2.5);
    const b = new Float64Array(n);
    rows.forEach((row, i) => row.forEach((v, j) => {
      b[i] += v * x[j];
      if (i !== j) b[j] += v * x[i];
    }));
    const solved = factorSymmetric(rows)!.solve(b);
    solved.forEach((v, i) => expect(v).toBeCloseTo(x[i], 9));
  });

  it('refuses a singular system', () => {
    const rows = symmetricRows(2);
    addSymmetric(rows, 0, 0, 1); addSymmetric(rows, 1, 1, 1); addSymmetric(rows, 1, 0, -1);
    expect(factorSymmetric(rows)).toBeNull();
  });
});

describe('createArapSolver', () => {
  const mesh = puppetMesh(square(), [{ x: 0, y: 0 }, { x: 100, y: 100 }], { vertices: 60 });
  const pinned = Array.from(mesh.pinVertex);

  it('meshes the fill with a vertex at each pin', () => {
    expect(mesh.triangles.length).toBeGreaterThan(30);
    close({ x: mesh.vertices[2 * pinned[0]], y: mesh.vertices[2 * pinned[0] + 1] }, { x: 0, y: 0 });
    close({ x: mesh.vertices[2 * pinned[1]], y: mesh.vertices[2 * pinned[1] + 1] }, { x: 100, y: 100 });
  });

  it('carries the mesh rigidly when the pins move rigidly', () => {
    const turn = 0.8, c = Math.cos(turn), s = Math.sin(turn);
    const move = (x: number, y: number): Point => ({ x: c * x - s * y + 30, y: s * x + c * y - 12 });
    const targets = pinned.flatMap((v) => {
      const p = move(mesh.vertices[2 * v], mesh.vertices[2 * v + 1]);
      return [p.x, p.y];
    });
    const out = createArapSolver(mesh, pinned).solve(targets);
    for (let v = 0; v < out.length / 2; v++) {
      close({ x: out[2 * v], y: out[2 * v + 1] }, move(mesh.vertices[2 * v], mesh.vertices[2 * v + 1]), 6);
    }
  });
});

describe('puppetMap', () => {
  it('holds every pin where it was dragged', () => {
    const pins = [
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
      { from: { x: 100, y: 100 }, to: { x: 140, y: 60 } },
      { from: { x: 50, y: 50 }, to: { x: 60, y: 45 } },
    ];
    const map = puppetMap(square(), pins);
    for (const pin of pins) close(map(pin.from), pin.to, 6);
  });

  it('bends through the shape: a limb left unpinned barely follows the limb beside it', () => {
    const shape = horseshoe(2);
    // Hold the base at both ends, and drag the left limb's tip out to the left.
    const pins = [
      { from: { x: 4, y: 90 }, to: { x: 4, y: 90 } },
      { from: { x: 38, y: 90 }, to: { x: 38, y: 90 } },
      { from: { x: 10, y: 5 }, to: { x: -40, y: 5 } },
    ];
    const map = puppetMap(shape, pins);
    const rightTip = { x: 32, y: 5 };
    const moved = map(rightTip);
    const leftMoved = map({ x: 10, y: 5 });
    expect(leftMoved.x).toBeCloseTo(-40, 6);
    // Across the 2-unit gap the right limb's tip is 22 units from the dragged
    // pin; a map weighing distance across the plane drags it most of the way.
    expect(Math.hypot(moved.x - rightTip.x, moved.y - rightTip.y)).toBeLessThan(10);
  });

  it('is undone by unwarpPoint', () => {
    const shape = square();
    const map = puppetMap(shape, [
      { from: { x: 0, y: 0 }, to: { x: 5, y: 0 } },
      { from: { x: 100, y: 0 }, to: { x: 110, y: 20 } },
    ]);
    const p = { x: 40, y: 70 };
    close(unwarpPoint(map, map(p), map(p), 1e-9), p, 5);
  });

  it('moves the whole shape with one pin, and leaves it be with none', () => {
    close(puppetMap(square(), [])({ x: 3, y: 4 }), { x: 3, y: 4 });
    close(puppetMap(square(), [{ from: { x: 50, y: 50 }, to: { x: 55, y: 57 } }])({ x: 10, y: 10 }), { x: 15, y: 17 });
  });
});

describe('puppetSolve', () => {
  const pins = [
    { from: { x: 10, y: 50 }, to: { x: 10, y: 50 } },
    { from: { x: 90, y: 50 }, to: { x: 120, y: 80 } },
  ];

  it('places the vertices puppetMap carries points by', () => {
    const shape = square();
    const solved = puppetSolve(shape, pins)!;
    const map = puppetMap(shape, pins);
    const V = solved.mesh.vertices;
    for (let i = 0; i < V.length / 2; i += 7) {
      close(map({ x: V[2 * i], y: V[2 * i + 1] }), { x: solved.vertices[2 * i], y: solved.vertices[2 * i + 1] });
    }
  });

  it('traces the solve, from the first linear step to the vertices it returns', () => {
    const steps: { stage: string; vertices: Float64Array }[] = [];
    const solved = puppetSolve(square(), pins, { trace: (s) => steps.push({ stage: s.stage, vertices: Float64Array.from(s.vertices) }) })!;
    expect(steps.slice(0, 2).map((s) => s.stage)).toEqual(['similarity', 'rigid']);
    expect(Array.from(steps.at(-1)!.vertices)).toEqual(Array.from(solved.vertices));
  });

  it('is null with no pins', () => {
    expect(puppetSolve(square(), [])).toBeNull();
  });
});
