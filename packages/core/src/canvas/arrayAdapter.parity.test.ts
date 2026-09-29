/**
 * `arrayAdapter` and `sceneToAdapter` answer marquee and lasso the same way
 * over the same nodes, once `arrayAdapter` is handed the painters' silhouette.
 */
import { describe, expect, it } from 'vitest';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import type { LassoHitMode } from 'core/adapters/types';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { PATH_L, PATH_M, PATH_Z } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { findShapeSilhouette } from './NodeShape';
import { sceneToAdapter } from './sceneAdapter';

/** Right triangle (0,0) → (100,0) → (0,100); its box's upper-right half is empty. */
const triangle = (dx: number, dy: number) => ({
  kind: 'polygon' as const,
  commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_Z),
  coords: Float32Array.of(dx, dy, dx + 100, dy, dx, dy + 100),
  fillRule: 'nonzero' as const,
});

function build() {
  const scene = createScene<unknown, string, unknown>({
    systemLayers: [{ id: 'default' }],
    initial: [
      // Polygon pose: the pose is the outline.
      { id: 'poly' as NodeId, kind: 'leaf', layer: 'default', pose: triangle(0, 0), data: null },
      // Kit-drawn shape: geometry on `data.path` behind a rect pose.
      {
        id: 'drawn' as NodeId, kind: 'leaf', layer: 'default',
        pose: { x: 200, y: 0, width: 100, height: 100 },
        data: { path: triangle(0, 0) },
      },
      // Rotated rect: its ink pokes out of its pose box.
      {
        id: 'turned' as NodeId, kind: 'leaf', layer: 'default',
        pose: { x: 0, y: 200, width: 100, height: 20, rotation: Math.PI / 4 },
        data: null,
      },
    ],
  });
  const nodes = [...scene.renderOrderNodes()];
  const array = arrayAdapter<(typeof nodes)[number], unknown>({
    ref: { current: nodes },
    setItems: () => {},
    toPose: (n) => n.pose,
    poseDescriptor: AUTO_POSE_DESCRIPTOR,
    silhouette: (n, pose) => findShapeSilhouette(n, pose),
  });
  return { array, scene: sceneToAdapter(scene) };
}

const MARQUEES = [
  { x: 90, y: 90, width: 8, height: 8 },     // empty corner of 'poly'
  { x: 0, y: 0, width: 8, height: 8 },       // filled corner of 'poly'
  { x: 290, y: 90, width: 8, height: 8 },    // empty corner of 'drawn'
  { x: 200, y: 0, width: 8, height: 8 },     // filled corner of 'drawn'
  { x: 15, y: 160, width: 15, height: 15 },  // the rotated corner above 'turned'
  { x: 40, y: 170, width: 20, height: 15 },  // empty part of 'turned's ink box
  { x: -10, y: -10, width: 400, height: 400 },
];

const LASSOS = [
  [{ x: 80, y: 80 }, { x: 99, y: 80 }, { x: 99, y: 99 }],
  [{ x: 280, y: 80 }, { x: 299, y: 80 }, { x: 299, y: 99 }],
  [{ x: -5, y: -5 }, { x: 160, y: -5 }, { x: -5, y: 160 }],
  [{ x: 195, y: -5 }, { x: 360, y: -5 }, { x: 195, y: 160 }],
  [{ x: -50, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 300 }, { x: -50, y: 300 }],
];

describe('arrayAdapter matches sceneToAdapter', () => {
  it('on every marquee', () => {
    const { array, scene } = build();
    for (const m of MARQUEES) {
      expect([...array.hitTestArea!(m)].sort(), JSON.stringify(m))
        .toEqual([...scene.hitTestArea!(m)].sort());
    }
  });

  it('on every lasso, in every mode', () => {
    const { array, scene } = build();
    for (const mode of ['centers', 'intersect', 'enclosed'] as LassoHitMode[]) {
      for (const l of LASSOS) {
        expect([...array.hitTestLasso!(l, mode)].sort(), `${mode} ${JSON.stringify(l)}`)
          .toEqual([...scene.hitTestLasso!(l, mode)].sort());
      }
    }
  });

  it('and neither takes a node by its bounding box alone', () => {
    const { array } = build();
    expect(array.hitTestArea!(MARQUEES[0])).toEqual([]);
    expect(array.hitTestArea!(MARQUEES[2])).toEqual([]);
    expect(array.hitTestArea!(MARQUEES[4])).toEqual(['turned']);
    expect(array.hitTestArea!(MARQUEES[5])).toEqual([]);
  });
});
