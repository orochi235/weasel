import { describe, it, expect } from 'vitest';
import type { RectPath, PolygonPath } from '../path';
import { PATH_M, PATH_L, PATH_Z, PATH_C, PATH_Q as PQ, PATH_C as PC } from '../commands';
import { tessellate } from './tessellate';

describe('tessellate (RectPath)', () => {
  it('emits 4 vertices and 2 triangles for a rect', () => {
    const path: RectPath = { kind: 'rect', x: 10, y: 20, width: 100, height: 50 };
    const mesh = tessellate(path);
    expect(Array.from(mesh.vertices)).toEqual([
      10, 20,
      110, 20,
      110, 70,
      10, 70,
    ]);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('emits a negative-size rect as given, without normalizing it', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: -10, height: -10 };
    const mesh = tessellate(path);
    expect(Array.from(mesh.vertices)).toEqual([0, 0, -10, 0, -10, -10, 0, -10]);
    expect(mesh.indices.length).toBe(6);
  });

  it('measures a rect far from 0 from an origin, so its corners keep their fractions', () => {
    const FAR = 262_144;
    const mesh = tessellate({ kind: 'rect', x: FAR + 0.3, y: 0.3, width: 1, height: 1 });
    expect(mesh.origin).toEqual({ x: FAR + 1, y: 1 });
    expect(mesh.vertices[0]! + mesh.origin!.x).toBeCloseTo(FAR + 0.3, 6);
    expect(tessellate({ kind: 'rect', x: 1, y: 1, width: 1, height: 1 }).origin).toBeUndefined();
  });
});

describe('tessellate (PolygonPath, single-contour, no curves)', () => {
  it('triangulates a square via M/L/L/L/Z', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('triangulates a concave hexagon (arrowhead)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 5, 0, 10, 2, 5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
  });

  it('triangulates a 100-vertex blob without throwing', () => {
    const verts: number[] = [];
    const cmds: number[] = [PATH_M];
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * Math.PI * 2;
      const r = 100 + (i % 5);
      verts.push(Math.cos(a) * r, Math.sin(a) * r);
      if (i > 0) cmds.push(PATH_L);
    }
    cmds.push(PATH_Z);
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(verts),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(200);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.length).toBe(294);
  });
});

import { DEFAULT_FLATTEN_TOLERANCE } from '../flatten';

describe('tessellate (PolygonPath, bezier curves)', () => {
  it('flattens a quadratic and triangulates the resulting polyline', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(6);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('flattens a cubic and triangulates', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PC, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 0, 10, 10, 10, 10, 0, 5, -5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBeGreaterThan(8);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('emits more vertices when given a tighter tolerance (more subdivision)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 50, 100, 100, 0]),
      fillRule: 'nonzero',
    };
    const looseMesh = tessellate(path, { flattenTolerance: 5 });
    const tightMesh = tessellate(path, { flattenTolerance: 0.05 });
    expect(tightMesh.vertices.length).toBeGreaterThan(looseMesh.vertices.length);
  });

  it('uses DEFAULT_FLATTEN_TOLERANCE when no option passed', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const a = tessellate(path);
    const b = tessellate(path, { flattenTolerance: DEFAULT_FLATTEN_TOLERANCE });
    expect(a.vertices.length).toBe(b.vertices.length);
  });
});

describe('tessellate (PolygonPath, evenodd)', () => {
  it('emits requiresStencil: true and a naive fan per contour for evenodd', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBe(true);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('emits separate fans per contour with continuous indexing for multi-contour evenodd', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        3, 3, 7, 3, 7, 7, 3, 7,
      ]),
      fillRule: 'evenodd',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBe(true);
    expect(mesh.vertices.length).toBe(16);
    expect(mesh.indices.length).toBe(12);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  });
});

describe('tessellate (PolygonPath, multi-contour, nonzero)', () => {
  it('triangulates a 10×10 outer square with a 4×4 inner hole (counter-wound)', () => {
    // Outer CCW: (0,0) (10,0) (10,10) (0,10)
    // Inner CW (hole): (3,3) (3,7) (7,7) (7,3)
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,         // outer
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,         // hole
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,                     // outer (CCW)
        3, 3, 3, 7, 7, 7, 7, 3,                         // hole  (CW)
      ]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    // 8 vertices total (4 outer + 4 hole), 8 triangles around the hole.
    expect(mesh.vertices.length).toBe(16);
    expect(mesh.indices.length).toBe(24);                // earcut emits 8 triangles for this case
  });
});

import { PathBuilder, polygonFromPoints, rectPath } from '../paths/builder';

describe('tessellate — anchor parameterization', () => {
  it('a rect mesh carries 4 anchor indices matching the corners', () => {
    const mesh = tessellate(rectPath(0, 0, 10, 10));
    expect(mesh.anchorA).toBeDefined();
    expect(mesh.anchorB).toBeDefined();
    expect(mesh.anchorT).toBeDefined();
    expect(mesh.anchorA!.length).toBe(mesh.vertices.length / 2);
    // Each rect vertex pinned to its own anchor.
    expect(Array.from(mesh.anchorA!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(mesh.anchorB!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(mesh.anchorT!)).toEqual([0, 0, 0, 0]);
  });

  it('a triangle polygon mesh has one anchor per vertex', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const mesh = tessellate(p);
    expect(mesh.anchorA!.length).toBe(3);
    expect(Array.from(mesh.anchorA!)).toEqual([0, 1, 2]);
  });

  it('a cubic-bezier-only polygon emits anchor params interpolating across the curve', () => {
    // Closed: M → C → L → Z (anchor 0 at the M, anchor 1 at the C destination,
    // anchor 2 at the L closing point). Flat polyline has many interior points.
    const p = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(0, 100, 100, 100, 100, 0)
      .lineTo(0, 0)
      .close()
      .build();
    const mesh = tessellate(p);
    const n = mesh.vertices.length / 2;
    expect(mesh.anchorA!.length).toBe(n);
    // First vertex should be anchor 0 (the M).
    expect(mesh.anchorA![0]).toBe(0);
    expect(mesh.anchorB![0]).toBe(0);
    // Some interior vertex along the curve must have anchorA = 0, anchorB = 1, t in (0,1).
    let foundInterior = false;
    for (let i = 1; i < n; i++) {
      if (mesh.anchorA![i] === 0 && mesh.anchorB![i] === 1 && mesh.anchorT![i] > 0 && mesh.anchorT![i] < 1) {
        foundInterior = true;
        break;
      }
    }
    expect(foundInterior).toBe(true);
  });
});

describe('tessellate — pen position after Z', () => {
  it('flattens a curve following Z from the subpath start, not from the last drawn point', () => {
    // SVG puts the pen back at the subpath start on Z, so the cubic below runs
    // from (0,0). Spelling the close as an explicit `L 0 0` must therefore
    // flatten the cubic to exactly the same points.
    const viaZ: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z, PATH_C]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 30, 20, 30, 20, 20]),
      fillRule: 'nonzero',
    };
    const viaLineTo: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_C]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 0, 0, 30, 20, 30, 20, 20]),
      fillRule: 'nonzero',
    };

    const z = Array.from(tessellate(viaZ).vertices);
    const l = Array.from(tessellate(viaLineTo).vertices);
    // `viaLineTo` emits one extra vertex for the explicit close; the cubic's
    // flattened run is the tail of both.
    const cubicLength = z.length - 3 * 2;
    expect(z.slice(-cubicLength)).toEqual(l.slice(-cubicLength));
  });
});

describe('tessellate (PolygonPath, nonzero, crossing or nested outlines)', () => {
  // Triangles strictly containing (x, y): 1 where the path fills, 0 in a hole;
  // 2 would blend a translucent fill twice. Probe off any diagonal earcut may cut.
  const coverage = (mesh: ReturnType<typeof tessellate>, x: number, y: number): number => {
    const v = mesh.vertices;
    let n = 0;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
      const side = (i: number, j: number) =>
        (v[j * 2] - v[i * 2]) * (y - v[i * 2 + 1]) - (x - v[i * 2]) * (v[j * 2 + 1] - v[i * 2 + 1]);
      const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
      if ((d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0)) n++;
    }
    return n;
  };
  const area = (mesh: ReturnType<typeof tessellate>): number => {
    const v = mesh.vertices;
    let sum = 0;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [mesh.indices[t] * 2, mesh.indices[t + 1] * 2, mesh.indices[t + 2] * 2];
      sum += Math.abs((v[b] - v[a]) * (v[c + 1] - v[a + 1]) - (v[c] - v[a]) * (v[b + 1] - v[a + 1])) / 2;
    }
    return sum;
  };
  const poly = (commands: number[], coords: number[]): PolygonPath => ({
    kind: 'polygon', commands: new Uint8Array(commands), coords: new Float32Array(coords), fillRule: 'nonzero',
  });
  const square = (x: number, y: number, s: number, cw: boolean) => ({
    cmds: [PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z],
    xy: cw ? [x, y, x + s, y, x + s, y + s, x, y + s] : [x, y, x, y + s, x + s, y + s, x + s, y],
  });

  it('fills both lobes of a bowtie once each', () => {
    const mesh = tessellate(poly([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z], [0, 0, 10, 10, 10, 0, 0, 10]));
    expect(coverage(mesh, 2, 5)).toBe(1);
    expect(coverage(mesh, 8, 5)).toBe(1);
    expect(coverage(mesh, 5, 1)).toBe(0);
  });

  it('fills the opposite-wound lobe of a curved outline that crosses itself', () => {
    const mesh = tessellate(poly([PATH_M, PATH_L, PATH_L, PATH_C, PATH_C, PATH_Z], [
      394.0009765625, 766.5681762695312, 384.3759765625, 618.3184814453125, 574.3128051757812, 686.1607055664062,
      574.3128051757812, 686.1607055664062, 588.0728149414062, 589.5969848632812, 462.7142639160156, 727.05029296875,
      337.35565185546875, 864.5035400390625, 394.0009765625, 766.5681762695312, 394.0009765625, 766.5681762695312,
    ]));
    expect(coverage(mesh, 429, 643)).toBe(1);
    expect(coverage(mesh, 555, 679)).toBe(1);
  });

  it('leaves the overlap of two oppositely wound squares empty', () => {
    const a = square(0, 0, 10, true), b = square(5, 5, 10, false);
    const mesh = tessellate(poly([...a.cmds, ...b.cmds], [...a.xy, ...b.xy]));
    expect(coverage(mesh, 2.3, 3.1)).toBe(1);
    expect(coverage(mesh, 7.2, 7.9)).toBe(0);
    expect(coverage(mesh, 12.4, 13.3)).toBe(1);
  });

  it('covers the overlap of two same-wound squares once', () => {
    const a = square(0, 0, 10, true), b = square(5, 5, 10, true);
    const mesh = tessellate(poly([...a.cmds, ...b.cmds], [...a.xy, ...b.xy]));
    expect(coverage(mesh, 2.3, 3.1)).toBe(1);
    expect(coverage(mesh, 7.2, 7.9)).toBe(1);
    expect(coverage(mesh, 12.4, 13.3)).toBe(1);
  });

  const squares = (...rings: [number, number, number, boolean][]) => {
    const parts = rings.map(([x, y, side, cw]) => square(x, y, side, cw));
    return poly(parts.flatMap((r) => r.cmds), parts.flatMap((r) => r.xy));
  };

  it('covers a same-wound square nested in a square once', () => {
    const mesh = tessellate(squares([0, 0, 10, true], [3, 3, 4, true]));
    expect(area(mesh)).toBeCloseTo(100);
    expect(coverage(mesh, 4.3, 5.1)).toBe(1);
    expect(coverage(mesh, 1.2, 1.7)).toBe(1);
  });

  it('keeps an opposite-wound nested square a hole', () => {
    const mesh = tessellate(squares([0, 0, 10, true], [3, 3, 4, false]));
    expect(area(mesh)).toBeCloseTo(84);
    expect(coverage(mesh, 4.3, 5.1)).toBe(0);
    expect(coverage(mesh, 1.2, 1.7)).toBe(1);
  });

  it('fills by winding through three levels of nesting', () => {
    // Inside each ring: 1, 2, 3 — all filled, once.
    const same = tessellate(squares([0, 0, 12, true], [2, 2, 8, true], [4, 4, 4, true]));
    expect(area(same)).toBeCloseTo(144);
    expect(coverage(same, 5.3, 6.1)).toBe(1);
    // 1, 0, 1 — an island in a hole.
    const island = tessellate(squares([0, 0, 12, true], [2, 2, 8, false], [4, 4, 4, true]));
    expect(area(island)).toBeCloseTo(144 - 64 + 16);
    expect(coverage(island, 3.1, 5.3)).toBe(0);
    expect(coverage(island, 5.3, 6.1)).toBe(1);
    // 1, 0, -1 — a hole wound past zero fills again.
    const pastZero = tessellate(squares([0, 0, 12, true], [2, 2, 8, false], [4, 4, 4, false]));
    expect(area(pastZero)).toBeCloseTo(144 - 64 + 16);
    expect(coverage(pastZero, 3.1, 5.3)).toBe(0);
    expect(coverage(pastZero, 5.3, 6.1)).toBe(1);
  });

  it("fills an 'o' by its counter's winding, in either contour order", () => {
    const counter = tessellate(squares([0, 0, 10, true], [3, 2, 4, false]));
    expect(coverage(counter, 4.3, 3.1)).toBe(0);
    expect(area(counter)).toBeCloseTo(84);
    const counterFirst = tessellate(squares([3, 2, 4, false], [0, 0, 10, true]));
    expect(coverage(counterFirst, 4.3, 3.1)).toBe(0);
    expect(area(counterFirst)).toBeCloseTo(84);
    const sameWound = tessellate(squares([0, 0, 10, true], [3, 2, 4, true]));
    expect(coverage(sameWound, 4.3, 3.1)).toBe(1);
    expect(area(sameWound)).toBeCloseTo(100);
  });
});
