import { describe, expect, it } from 'vitest';
import { createScene, type SnapCollect, type SnapMark } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { pose3, type Pose3 } from '../pose3';
import { alignPlaneSource } from './sources';

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

describe('alignPlaneSource', () => {
  it('offers a plane two boxes share once, and marks it to both', () => {
    // Both boxes have their min x at -0.5.
    const scene = createScene<object, 'solids', Pose3>({
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
