import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, createScene, type SnapCollect, type SnapMark } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { pose3, type Pose3 } from '../pose3';
import { alignPlaneSource, groundGridSource } from './sources';

/** A world for a grid source, which reads only its `up`. */
const GROUND = { viewport: () => ({ camera: createCamera({}), width: 800, height: 600 }) };

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

describe('alignPlaneSource', () => {
  it('offers a plane two boxes share once, and marks it to both', () => {
    // Both boxes have their min x at -0.5.
    const scene = createScene<object, 'solids', Pose3>({ composition: IDENTITY_POSE_COMPOSITION,
      systemLayers: [{ id: 'solids' }],
      initial: [pose3({ x: 0, y: 0.5, z: -4 }), pose3({ x: 0, y: 0.5, z: -8 })]
        .map((pose) => ({ kind: 'mark' as const, layer: 'solids' as const, pose, data: {} })),
    });
    const world = { scene, viewport: () => ({ camera: createCamera({}), width: 800, height: 600 }) };
    const probe = { id: 'box.min', at: { x: -0.48, y: 3, z: 6 }, role: 'box' as const };
    const q: SnapCollect<Vec3> = {
      gesture: 'move', probes: [probe], delta0: ZERO, exclude: [], reachWorld: () => 0.1, reachPx: 8,
    };
    const onMinX = [...alignPlaneSource(world).collect(q)]
      .filter((c) => c.locus.at.x === -0.5 && c.locus.dirs.every((d) => d.x === 0));
    expect(onMinX).toHaveLength(1);
    const mark = onMinX[0]!.mark as (delta: Vec3) => SnapMark<Vec3>[];
    const lines = mark({ x: -0.02, y: 0, z: 0 });
    expect(lines.map((l) => (l.kind === 'line' ? l.to.z : NaN)).sort((a, b) => a - b)).toEqual([-8, -4]);
    for (const l of lines) expect(l).toMatchObject({ kind: 'line', from: { x: -0.5, y: 3, z: 6 } });
  });
});

describe('alignPlaneSource over an unbounded box', () => {
  it('still offers the plane a floor shares with the boxes resting on it, at a finite point', () => {
    const scene = createScene<{ floor?: boolean }, 'solids', Pose3>({ composition: IDENTITY_POSE_COMPOSITION,
      systemLayers: [{ id: 'solids' }],
      initial: [
        { kind: 'mark' as const, layer: 'solids' as const, pose: pose3({ x: 0, y: 0, z: 0 }), data: { floor: true } },
        { kind: 'mark' as const, layer: 'solids' as const, pose: pose3({ x: 3, y: 0.5, z: -4 }), data: {} },
      ],
    });
    const world = {
      scene,
      viewport: () => ({ camera: createCamera({}), width: 800, height: 600 }),
      bounds: (node: { data: { floor?: boolean }; pose: Pose3 }) => (node.data.floor
        ? { min: { x: -Infinity, y: -0.1, z: -Infinity }, max: { x: Infinity, y: 0, z: Infinity } }
        : { min: { x: 2.5, y: 0, z: -4.5 }, max: { x: 3.5, y: 1, z: -3.5 } }),
    };
    const probe = { id: 'box.min', at: { x: 0.2, y: 0.02, z: 1 }, role: 'box' as const };
    const q: SnapCollect<Vec3> = {
      gesture: 'move', probes: [probe], delta0: ZERO, exclude: [], reachWorld: () => 0.1, reachPx: 8,
    };
    const found = [...alignPlaneSource(world).collect(q)];
    for (const c of found) {
      expect([c.locus.at.x, c.locus.at.y, c.locus.at.z].every(Number.isFinite)).toBe(true);
    }
    const onFloor = found.filter((c) => c.locus.at.y === 0 && c.locus.dirs.every((d) => d.y === 0));
    expect(onFloor).toHaveLength(1);
    const lines = (onFloor[0]!.mark as (delta: Vec3) => SnapMark<Vec3>[])(ZERO);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'line', to: { x: 3, y: 0, z: -4 } });
  });
});

describe('groundGridSource', () => {
  const probe = { id: 'pointer', at: { x: 0.3, y: 0, z: -1.7 }, role: 'pointer' as const };
  const q: SnapCollect<Vec3> = {
    gesture: 'point', probes: [probe], delta0: ZERO, exclude: [], reachWorld: () => 0.1, reachPx: 8,
  };

  it('offers the grid lines either side of a probe on the ground', () => {
    expect([...groundGridSource({ world: GROUND, step: 1 }).collect(q)]).toHaveLength(4);
  });

  it("lies on its world's ground, as the session that probes it does", () => {
    const flat = { ...probe, at: { x: 0.3, y: -1.7, z: 0 } };
    const zUp = { ...q, probes: [flat] };
    expect([...groundGridSource({ step: 1, world: { ...GROUND, up: { x: 0, y: 0, z: 1 } } }).collect(zUp)]).toHaveLength(4);
  });

  it('offers nothing for a step that is zero, negative or not finite', () => {
    for (const step of [0, -1, NaN, Infinity]) {
      expect([...groundGridSource({ world: GROUND, step }).collect(q)]).toEqual([]);
    }
  });
});
