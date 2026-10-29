import { describe, expect, it } from 'vitest';
import { IMPERIAL_INCHES, type SnapCollect } from '@weasel-js/core';
import { polygonFromPoints } from '@weasel-js/geom';
import { gridSnapSource } from './grid';
import { drive, expectNear, moveBy, sceneOf } from './testing/session';

type Point = { x: number; y: number };

const point = (source: ReturnType<typeof gridSnapSource>, p: Point) => drive({ sources: [source] }).at(p).point;

describe('gridSnapSource', () => {
  it('is an unlimited-reach fallback over box, origin and pointer probes', () => {
    expect(gridSnapSource({ spacing: 10 })).toMatchObject({ tier: 'fallback', reachPx: Infinity, roles: ['box', 'origin', 'pointer'] });
  });

  it('offers the grid line on either side of a probe on each axis', () => {
    const q = {
      gesture: 'point', probes: [{ id: 'pointer', at: { x: 13, y: 3 }, role: 'pointer' }], delta0: { x: 0, y: 0 },
      exclude: [], reachWorld: (px: number) => px, reachPx: 8,
    } as SnapCollect;
    const found = [...gridSnapSource({ spacing: 10 }).collect(q)];
    expect(found.map((c) => [c.locus.at, c.locus.dirs[0]])).toEqual([
      [{ x: 10, y: 3 }, { x: 0, y: 1 }],
      [{ x: 20, y: 3 }, { x: 0, y: 1 }],
      [{ x: 13, y: 0 }, { x: 1, y: 0 }],
      [{ x: 13, y: 10 }, { x: 1, y: 0 }],
    ]);
  });

  it('snaps a pointer to the nearest cell', () => {
    const grid = gridSnapSource({ spacing: 10 });
    expectNear(point(grid, { x: 7, y: 13 }), { x: 10, y: 10 });
    expectNear(point(grid, { x: 24, y: -3 }), { x: 20, y: 0 });
  });

  it('snaps to the resolved base-unit grid for a tagged spacing', () => {
    // 1ft = 12in.
    const grid = gridSnapSource({ spacing: { value: 1, unit: 'ft' }, unitSystem: IMPERIAL_INCHES });
    expectNear(point(grid, { x: 5, y: 0 }), { x: 0, y: 0 });
    expectNear(point(grid, { x: 7, y: 17 }), { x: 12, y: 12 });
    expectNear(point(grid, { x: 30, y: 30 }), { x: 36, y: 36 });
  });

  it('throws for a tagged spacing with no unit system', () => {
    expect(() => gridSnapSource({ spacing: { value: 1, unit: 'ft' } })).toThrow(/UnitSystem/);
  });

  it('snaps each axis to its own pitch and unit system', () => {
    expectNear(point(gridSnapSource({ spacing: { x: 10, y: 4 } }), { x: 17, y: 5 }), { x: 20, y: 4 });
    const SECONDS = { base: 'ms', units: { ms: 1, s: 1000 } };
    const VOLTS = { base: 'V', units: { V: 1, dV: 0.1 } };
    const grid = gridSnapSource({
      spacing: { x: { value: 1, unit: 's' }, y: { value: 5, unit: 'dV' } },
      unitSystem: { x: SECONDS, y: VOLTS },
    });
    expectNear(point(grid, { x: 1400, y: 0.8 }), { x: 1000, y: 1 });
  });

  it('shifts the lattice to pass through its origin', () => {
    expectNear(point(gridSnapSource({ spacing: 10, origin: { x: 5, y: 5 } }), { x: 12, y: 13 }), { x: 15, y: 15 });
  });

  it('lands a move where the box rounds, not where the delta does', () => {
    const box = { x: 0, y: 0, width: 4, height: 4 };
    expectNear(moveBy({ sources: [gridSnapSource({ spacing: 1 })], box }).by(1.4, 2.6).point, { x: 1, y: 3 });
    // 0.2 + 0.2 lands on 0.5; the delta alone would round to 0.
    const off = { x: 0.2, y: 0.2, width: 4, height: 4 };
    expectNear(moveBy({ sources: [gridSnapSource({ spacing: 0.5 })], box: off }).by(0.2, 0.2).point, { x: 0.3, y: 0.3 });
  });

  it('lets a move go free while snapping is suspended', () => {
    const box = { x: 0, y: 0, width: 4, height: 4 };
    const out = moveBy({ sources: [gridSnapSource({ spacing: 1 })], box }).by(1.4, 2.6, { suspend: true, constrain: false });
    expectNear(out.point, { x: 1.4, y: 2.6 });
    expect(out.held).toBe(false);
  });

  it('rounds a moved box to the camera\'s grid', () => {
    // A 6-unit drag puts the left edge at 106, which a 10 grid rounds to 110.
    const box = { x: 100, y: 50, width: 20, height: 20 };
    expectNear(moveBy({ sources: [gridSnapSource({ spacing: 10 })], box }).by(6, 0).point, { x: 10, y: 0 });
  });

  it('rounds a node on a parallax plane to the camera\'s grid', () => {
    // plane = 2 * camera - 100 on x, 2 * camera on y. A 12, 4 drag puts the
    // box's center at plane (122, 44): camera (111, 22), which rounds to
    // (110, 20), plane (120, 40).
    const plane = { scale: { x: 2, y: 2 }, offset: { x: -100, y: 0 } };
    const box = { x: 100, y: 30, width: 20, height: 20 };
    expectNear(moveBy({ sources: [gridSnapSource({ spacing: 10 })], box, plane }).by(12, 4).point, { x: 10, y: 0 });
  });

  it('lands whichever of a path\'s box edges and center is nearest a line', () => {
    // The box spans 7..17 by 13..23; its center, (12, 18), is nearest on both axes.
    const { scene } = sceneOf([]);
    const id = scene.add({ kind: 'mark', layer: 'default', pose: polygonFromPoints([{ x: 7, y: 13 }, { x: 17, y: 13 }, { x: 12, y: 23 }]), data: {} }) as string;
    expectNear(moveBy({ sources: [gridSnapSource({ spacing: 10 })], scene, ids: [id] }).by(0, 0).point, { x: -2, y: 2 });
  });

  it('lands a stroked rect with its stroke\'s outer edge on a line', () => {
    // A 10-wide stroke reaches 5 past the rect at 102, 102: its drawn box
    // starts at 97, 97, and moves 3 to put that corner on the 20 grid.
    const stroked = { shape: 'rect', stroke: { paint: { kind: 'solid', color: '#f00' }, width: 10 } };
    const rect = { x: 102, y: 102, width: 100, height: 50 };
    const grid = () => gridSnapSource({ spacing: 20 });
    const { scene, ids } = sceneOf([{ ...rect, data: stroked }]);
    expectNear(moveBy({ sources: [grid()], scene, ids }).by(0, 0).point, { x: 3, y: 3 });
    // Unstroked, the rect's own corner is what lands, 2 back.
    expectNear(moveBy({ sources: [grid()], box: rect }).by(0, 0).point, { x: -2, y: -2 });
  });

  it('moves the snapped point steadily as the pointer sweeps, zoomed far out', () => {
    // At 0.05 a 10-unit cell is half a pixel; step the pointer 0.1px (2 units).
    const d = drive({ sources: [gridSnapSource({ spacing: 10 })], scale: 0.05 });
    let last = -Infinity;
    for (let i = 0; i <= 500; i++) {
      const x = d.at({ x: i * 2, y: 3 }).point.x;
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
    expect(last).toBe(1000);
  });
});
