import { describe, expect, it } from 'vitest';
import { PathBuilder } from '../paths/builder';
import type { Point } from '../paths/cubicMath';
import { addSymmetric, factorSymmetric, symmetricRows } from './profileCholesky';
import { createArapSolver } from './arap';
import { pinWarpMesh } from './pinWarpMesh';
import { pinWarpMap, pinWarpSolve, unwarpPoint } from './pinWarp';

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
    const factored = factorSymmetric(rows)!;
    const solved = factored.solve(b);
    solved.forEach((v, i) => expect(v).toBeCloseTo(x[i], 9));
    const other = Float64Array.from(b, (v, i) => v * (i % 3) - 1);
    const pair = factored.solvePair(Float64Array.from({ length: 2 * n }, (_, k) => (k & 1 ? other : b)[k >> 1]));
    const second = factored.solve(other);
    for (let i = 0; i < n; i++) {
      expect(pair[2 * i]).toBe(solved[i]);
      expect(pair[2 * i + 1]).toBe(second[i]);
    }
  });

  it('refuses a singular system', () => {
    const rows = symmetricRows(2);
    addSymmetric(rows, 0, 0, 1); addSymmetric(rows, 1, 1, 1); addSymmetric(rows, 1, 0, -1);
    expect(factorSymmetric(rows)).toBeNull();
  });
});

describe('createArapSolver', () => {
  const mesh = pinWarpMesh(square(), [{ x: 0, y: 0 }, { x: 100, y: 100 }], { vertices: 60 });
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

  it('moves a piece too degenerate to solve over with its own pins', () => {
    // A piece whose one triangle has no area, holding two pins, beside a piece with a pin of its own.
    const flatMesh = {
      vertices: Float64Array.from([0, 0, 0, 0, 0, 0, 100, 100, 110, 100, 100, 110]),
      triangles: Uint32Array.from([0, 1, 2, 3, 4, 5]),
    };
    const out = createArapSolver(flatMesh, [0, 1, 3]).solve([7, 5, 7, 5, 100, 100]);
    close({ x: out[4], y: out[5] }, { x: 7, y: 5 });
    close({ x: out[8], y: out[9] }, { x: 110, y: 100 });
  });
});

describe('pinWarpMap', () => {
  it('holds every pin where it was dragged', () => {
    const pins = [
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
      { from: { x: 100, y: 100 }, to: { x: 140, y: 60 } },
      { from: { x: 50, y: 50 }, to: { x: 60, y: 45 } },
    ];
    const map = pinWarpMap(square(), pins);
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
    const map = pinWarpMap(shape, pins);
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
    const map = pinWarpMap(shape, [
      { from: { x: 0, y: 0 }, to: { x: 5, y: 0 } },
      { from: { x: 100, y: 0 }, to: { x: 110, y: 20 } },
    ]);
    const p = { x: 40, y: 70 };
    close(unwarpPoint(map, map(p), map(p), 1e-9), p, 5);
  });

  it.each([90, 180, 270])('undoes a map that turns the shape %i degrees', (deg) => {
    const a = (deg * Math.PI) / 180, c = { x: 50, y: 50 };
    const turn = (p: Point) => ({
      x: c.x + Math.cos(a) * (p.x - c.x) - Math.sin(a) * (p.y - c.y),
      y: c.y + Math.sin(a) * (p.x - c.x) + Math.cos(a) * (p.y - c.y),
    });
    const p = { x: 20, y: 85 };
    close(unwarpPoint(turn, turn(p)), p, 3);
  });

  it('undoes a pin warp that turns the shape half over', () => {
    const map = pinWarpMap(square(), [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
      { from: { x: 100, y: 100 }, to: { x: 0, y: 0 } },
    ]);
    const p = { x: 30, y: 60 };
    close(unwarpPoint(map, map(p), map(p), 1e-9), p, 5);
  });

  it('moves an outline point by the mean drag of the pins that snapped to it', () => {
    const pins = [
      { from: { x: -50, y: 50 }, to: { x: -50, y: 50 } },
      { from: { x: -10, y: 50 }, to: { x: -10, y: 80 } },
      { from: { x: 100, y: 50 }, to: { x: 100, y: 50 } },
    ];
    expect(pinWarpMesh(square(), pins.map((p) => p.from)).pinVertex[0]).toBe(pinWarpMesh(square(), pins.map((p) => p.from)).pinVertex[1]);
    close(pinWarpMap(square(), pins)({ x: 0, y: 50 }), { x: 0, y: 65 }, 3);
  });

  it('meshes the whole fill, and puts every pin at its target', () => {
    const pts = [[154, 100], [120, 114], [128, 187], [90, 130], [33, 149], [60, 100], [47, 62], [87, 60], [119, 42], [177, 44]];
    const b = new PathBuilder();
    pts.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y)));
    const shape = b.close().build();
    const froms = [{ x: 131, y: 110 }, { x: 100, y: 103 }, { x: 103, y: 73 }];
    const mesh = pinWarpMesh(shape, froms);
    const T = mesh.triangles, V = mesh.vertices;
    let area = 0;
    for (let t = 0; t < T.length; t += 3) {
      const [a, b2, c] = [T[t], T[t + 1], T[t + 2]];
      area += ((V[2 * b2] - V[2 * a]) * (V[2 * c + 1] - V[2 * a + 1]) - (V[2 * c] - V[2 * a]) * (V[2 * b2 + 1] - V[2 * a + 1])) / 2;
    }
    expect(Math.abs(area)).toBeCloseTo(9190, 6);
    const held = new Set(mesh.triangles);
    mesh.pinVertex.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(held.has(v)).toBe(true); });
    const pins = froms.map((p, k) => ({ from: p, to: { x: p.x + 4 * k, y: p.y - 3 * k } }));
    const { vertices } = pinWarpSolve(shape, pins)!;
    mesh.pinVertex.forEach((v, k) => close({ x: vertices[2 * v], y: vertices[2 * v + 1] }, { x: mesh.vertices[2 * v] + 4 * k, y: mesh.vertices[2 * v + 1] - 3 * k }));
  });

  it('meshes an even-odd pentagram without its empty center', () => {
    const b = new PathBuilder();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i * 4 * Math.PI) / 5;
      if (i) b.lineTo(100 + 100 * Math.cos(a), 100 + 100 * Math.sin(a)); else b.moveTo(100 + 100 * Math.cos(a), 100 + 100 * Math.sin(a));
    }
    const star = { ...b.close().build(), fillRule: 'evenodd' as const };
    const mesh = pinWarpMesh(star, []);
    const T = mesh.triangles, V = mesh.vertices;
    let area = 0;
    for (let t = 0; t < T.length; t += 3) {
      const [a, b2, c] = [T[t], T[t + 1], T[t + 2]];
      area += Math.abs((V[2 * b2] - V[2 * a]) * (V[2 * c + 1] - V[2 * a + 1]) - (V[2 * c] - V[2 * a]) * (V[2 * b2 + 1] - V[2 * a + 1])) / 2;
    }
    // Five tips, each a triangle on one side of the inner pentagon, whose circumradius is R·sin18°/sin126°.
    const r = (100 * Math.sin(Math.PI / 10)) / Math.sin((7 * Math.PI) / 10);
    const side = 2 * r * Math.sin(Math.PI / 5);
    const tips = 5 * 0.5 * side * (side / 2) * Math.tan((2 * Math.PI) / 5);
    expect(area).toBeCloseTo(tips, 0);
  });

  it('moves the whole shape with one pin, and leaves it be with none', () => {
    close(pinWarpMap(square(), [])({ x: 3, y: 4 }), { x: 3, y: 4 });
    close(pinWarpMap(square(), [{ from: { x: 50, y: 50 }, to: { x: 55, y: 57 } }])({ x: 10, y: 10 }), { x: 15, y: 17 });
  });
});

describe('pinWarpSolve', () => {
  const pins = [
    { from: { x: 10, y: 50 }, to: { x: 10, y: 50 } },
    { from: { x: 90, y: 50 }, to: { x: 120, y: 80 } },
  ];

  it('places the vertices pinWarpMap carries points by', () => {
    const shape = square();
    const solved = pinWarpSolve(shape, pins)!;
    const map = pinWarpMap(shape, pins);
    const V = solved.mesh.vertices;
    for (let i = 0; i < V.length / 2; i += 7) {
      close(map({ x: V[2 * i], y: V[2 * i + 1] }), { x: solved.vertices[2 * i], y: solved.vertices[2 * i + 1] });
    }
  });

  it('traces the solve, from the first linear step to the vertices it returns', () => {
    const steps: { stage: string; vertices: Float64Array }[] = [];
    const solved = pinWarpSolve(square(), pins, { trace: (s) => steps.push({ stage: s.stage, vertices: Float64Array.from(s.vertices) }) })!;
    expect(steps.slice(0, 2).map((s) => s.stage)).toEqual(['similarity', 'rigid']);
    expect(Array.from(steps.at(-1)!.vertices)).toEqual(Array.from(solved.vertices));
  });

  it('is null with no pins', () => {
    expect(pinWarpSolve(square(), [])).toBeNull();
  });
});
