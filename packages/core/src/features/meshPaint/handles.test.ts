import { describe, it, expect } from 'vitest';
import { meshGuides, meshHandles, moveMeshHandle, type MeshHandle } from './handles';
import { meshFromStops, seedMeshPatch, type MeshGradientFill } from './meshPaint';
import { evalPatch, type MeshPatch, type MeshPoint } from './surface';

/** A straight-edged square patch over `[x0, x0+1] × [0, 1]`, controls at the thirds. */
function square(x0 = 0): MeshPatch {
  const corners: MeshPoint[] = [
    { x: x0, y: 0 }, { x: x0 + 1, y: 0 }, { x: x0 + 1, y: 1 }, { x: x0, y: 1 },
  ];
  const points: MeshPoint[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    points.push(
      a,
      { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
      { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 },
    );
  }
  return { points, colors: ['#f00', '#0f0', '#00f', '#ff0'] };
}

/** The same square as a flat tensor patch, interior in PDF's order. */
function tensor(): MeshPatch {
  return {
    ...square(),
    points: [
      ...square().points,
      { x: 1 / 3, y: 1 / 3 }, { x: 1 / 3, y: 2 / 3 },
      { x: 2 / 3, y: 2 / 3 }, { x: 2 / 3, y: 1 / 3 },
    ],
  };
}

function mesh(...patches: MeshPatch[]): MeshGradientFill {
  return { fill: 'mesh-gradient', patches, units: 'local' };
}

function handleAt(handles: readonly MeshHandle[], kind: MeshHandle['kind'], x: number, y: number): MeshHandle {
  const hit = handles.find((h) => h.kind === kind && Math.abs(h.at.x - x) < 1e-9 && Math.abs(h.at.y - y) < 1e-9);
  if (!hit) throw new Error(`no ${kind} handle at ${x},${y}`);
  return hit;
}

describe('meshHandles', () => {
  it('gives a Coons patch four corners and eight edge controls', () => {
    const handles = meshHandles(mesh(square()));
    expect(handles.filter((h) => h.kind === 'corner')).toHaveLength(4);
    expect(handles.filter((h) => h.kind === 'control')).toHaveLength(8);
    expect(handles.filter((h) => h.kind === 'interior')).toHaveLength(0);
  });

  it('adds the four interior points of a tensor patch', () => {
    const handles = meshHandles(mesh(tensor()));
    expect(handles.filter((h) => h.kind === 'interior')).toHaveLength(4);
  });

  it('merges the points two patches share into one handle', () => {
    // Two bands side by side share an edge: two corners and its two controls.
    const handles = meshHandles(mesh(square(0), square(1)));
    expect(handles.filter((h) => h.kind === 'corner')).toHaveLength(6);
    expect(handles.filter((h) => h.kind === 'control')).toHaveLength(14);
    expect(handleAt(handles, 'corner', 1, 0).refs).toHaveLength(2);
  });

  it('skips a patch that cannot be evaluated', () => {
    const broken: MeshPatch = { points: square().points.slice(0, 5), colors: square().colors };
    expect(meshHandles(mesh(broken))).toHaveLength(0);
  });

  it('gives every handle an id that survives the handle moving', () => {
    const before = meshHandles(mesh(square()));
    const corner = handleAt(before, 'corner', 1, 1);
    const after = meshHandles(moveMeshHandle(mesh(square()), corner, { x: 3, y: 4 }));
    expect(after.map((h) => h.id)).toEqual(before.map((h) => h.id));
  });
});

describe('moveMeshHandle', () => {
  it('moves a control point alone', () => {
    const m = mesh(square());
    const control = handleAt(meshHandles(m), 'control', 1 / 3, 0);
    const next = moveMeshHandle(m, control, { x: 0.3, y: -0.5 });
    expect(next.patches[0].points[1]).toEqual({ x: 0.3, y: -0.5 });
    expect(next.patches[0].points.filter((_, i) => i !== 1)).toEqual(square().points.filter((_, i) => i !== 1));
  });

  it('carries a corner’s two edge controls with it', () => {
    const m = mesh(square());
    const next = moveMeshHandle(m, handleAt(meshHandles(m), 'corner', 0, 0), { x: -1, y: -2 });
    const p = next.patches[0].points;
    expect(p[0]).toEqual({ x: -1, y: -2 });
    expect(p[1]).toEqual({ x: 1 / 3 - 1, y: -2 });
    // The control returning to corner 0 closes the walk, at index 11.
    expect(p[11].x).toBe(-1);
    expect(p[11].y).toBeCloseTo(1 / 3 - 2, 12);
    expect(p[4]).toEqual(square().points[4]);
  });

  it('carries the interior point nearest the corner in a tensor patch', () => {
    // Corner 1 is (1,0); its interior neighbor is the fourth trailing point,
    // not the second — the net's interior is read in PDF's transposed order.
    const m = mesh(tensor());
    const next = moveMeshHandle(m, handleAt(meshHandles(m), 'corner', 1, 0), { x: 2, y: 0 });
    const p = next.patches[0].points;
    expect(p[15]).toEqual({ x: 2 / 3 + 1, y: 1 / 3 });
    expect(p[13]).toEqual(tensor().points[13]);
  });

  it('moves a shared corner in every patch so the mesh does not tear', () => {
    const m = mesh(square(0), square(1));
    const next = moveMeshHandle(m, handleAt(meshHandles(m), 'corner', 1, 1), { x: 1.5, y: 1.5 });
    expect(next.patches[0].points[6]).toEqual({ x: 1.5, y: 1.5 });
    expect(next.patches[1].points[9]).toEqual({ x: 1.5, y: 1.5 });
    // And the surfaces still meet along the shared edge.
    for (const t of [0.25, 0.5, 0.75]) {
      const a = evalPatch(next.patches[0], 1, t);
      const b = evalPatch(next.patches[1], 0, t);
      expect(a.x).toBeCloseTo(b.x, 9);
      expect(a.y).toBeCloseTo(b.y, 9);
    }
  });

  it('reshapes the painted surface', () => {
    const m = seedMeshPatch('#3366ccff');
    const handles = meshHandles(m);
    const before = evalPatch(m.patches[0], 0.5, 0.5);
    const next = moveMeshHandle(m, handles.find((h) => h.kind === 'corner')!, { x: -1, y: -1 });
    const after = evalPatch(next.patches[0], 0.5, 0.5);
    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBeLessThan(before.y);
  });

  it('leaves the input untouched and keeps colors, units and space', () => {
    const m: MeshGradientFill = { ...meshFromStops([
      { offset: 0, color: '#000' }, { offset: 1, color: '#fff' },
    ]), interpolate: 'oklch' };
    const snapshot = JSON.stringify(m);
    const next = moveMeshHandle(m, meshHandles(m)[0], { x: 9, y: 9 });
    expect(JSON.stringify(m)).toBe(snapshot);
    expect(next.units).toBe('bounds');
    expect(next.interpolate).toBe('oklch');
    expect(next.patches[0].colors).toEqual(m.patches[0].colors);
  });
});

describe('meshGuides', () => {
  it('draws each patch’s four edges as cubic control polygons', () => {
    const { edges } = meshGuides(mesh(square()));
    expect(edges).toHaveLength(4);
    const p = square().points;
    expect(edges[0]).toEqual([p[0], p[1], p[2], p[3]]);
    // The last edge closes the walk back onto corner 0.
    expect(edges[3]).toEqual([p[9], p[10], p[11], p[0]]);
  });

  it('draws an arm from each corner to each point it carries', () => {
    const { arms } = meshGuides(mesh(tensor()));
    // Two edge controls and one interior point per corner.
    expect(arms).toHaveLength(12);
    const p = tensor().points;
    expect(arms).toContainEqual([p[3], p[15]]);
    expect(arms).toContainEqual([p[9], p[13]]);
  });
});
