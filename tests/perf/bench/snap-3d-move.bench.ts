/**
 * One frame of a 3D move's snap against box count: a unit box dragged through
 * a square grid of unit boxes, with kernel3d's box, alignment-plane and
 * ground-grid sources at the default 8px reach. A frame is gathering the
 * candidates plus `resolveSnap`'s search over them.
 *
 * Nearly all of a frame is the resolver's pair search; gathering and
 * projection are about a tenth. The per-probe pool cap bounds that search.
 * Measured by this bench on teitou (2026-10-18), at spacings of 3 and 1.6:
 * a mean of 1.1–1.2 ms a frame at 50 boxes, 2.0–2.6 ms at 200.
 *
 * `SNAP3D_BENCH_SIZES=50,200` picks the box counts; the default is 50 and 200.
 */
import { createScene, type NodeId } from '@weasel-js/core';
import {
  alignPlaneSource, boxSnapSource, createCamera, createSnap, groundGridSource, pose3, screenBoxOf,
  type Pose3, type Viewport3d,
} from '@weasel-js/kernel3d';
import { group } from './group';

const SIZES = (process.env.SNAP3D_BENCH_SIZES ?? '50,200').split(',').map(Number);
const SPACINGS = [1.6, 3];
const FREE = { suspend: false, constrain: false };

function frames(n: number, spacing: number): () => void {
  const side = Math.ceil(Math.sqrt(n));
  const scene = createScene<object, 'solids', Pose3>({
    systemLayers: [{ id: 'solids' }],
    initial: Array.from({ length: n }, (_, i) => ({
      kind: 'leaf' as const,
      layer: 'solids' as const,
      pose: pose3({ x: (i % side) * spacing, y: 0.5, z: Math.floor(i / side) * spacing }),
      data: {},
    })),
  });
  const mid = (side * spacing) / 2;
  const vp: Viewport3d = {
    camera: createCamera({ distance: side * spacing * 1.2, pitch: 0.6, yaw: 0.4, target: { x: mid, y: 0.5, z: mid } }),
    width: 1200,
    height: 800,
  };
  const world = { scene, viewport: () => vp };
  const id = [...scene.renderOrder()][Math.floor(n / 2)] as NodeId;
  const snap = createSnap(world, {
    sources: [boxSnapSource(world), alignPlaneSource(world), groundGridSource({ step: 1 })],
  });
  const box = screenBoxOf(world, id, vp)!;
  const press = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = snap.begin!({ gesture: 'move', ids: [id], press });
  let i = 0;
  return () => {
    session.at({ x: press.x + (i % 120) * 1.3, y: press.y + (i % 90) * 0.9 }, FREE);
    i++;
  };
}

group('snap — 3D move frame against a grid of boxes', (bench) => {
  for (const n of SIZES) {
    for (const spacing of SPACINGS) bench(`${n} boxes, spacing ${spacing}`, frames(n, spacing));
  }
}, { time: 0, iterations: 300, warmupTime: 0, warmupIterations: 30 });
