/**
 * What the pick-index tests drive `pickWalk` with: a scene holding every kind
 * of node the walk treats differently, and the point and region queries the
 * scene's picks ask, each carrying the broad box its entry point sets.
 */
import { linePath, rotateAboutPoint, translate, PATH_L, PATH_M, PATH_Z, type Affine, type Path } from '@weasel-js/geom';
import type { LassoHitMode } from 'core/adapters/types';
import type { SelectRegion } from 'core/geometry/regionHit';
import { IDENTITY_POSE_COMPOSITION, RIGID_POSE_COMPOSITION } from 'core/scene/composePose';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { regionPickQuery } from 'canvas/deps/hitTestArea';
import { scenePointQuery } from 'canvas/SceneCanvas/scenePointQuery';
import type { PickQuery } from 'canvas/pickWalk';

type AnyScene = Scene<unknown, string, unknown>;

/** The select tool's point query at `(x, y)` under view scale `s`. */
export function pointPick(
  d: PoseDescriptor<unknown>,
  x: number,
  y: number,
  s: { x: number; y: number },
  tolerancePx = 4,
): PickQuery<unknown> {
  return scenePointQuery<unknown>(d, true, tolerancePx)(x, y, s);
}

/** A marquee's or a lasso's query over `region`. */
export function regionPick(
  region: SelectRegion,
  mode: LassoHitMode,
  d: PoseDescriptor<unknown>,
  includeGroups = false,
): PickQuery<unknown> {
  return regionPickQuery(region, mode, d, { includeGroups });
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOLID = { paint: { kind: 'solid', color: '#336699' } };
const INK = { kind: 'solid', color: '#000000' };

const square = (x: number, y: number, w: number): Path => ({
  kind: 'polygon',
  commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z),
  coords: Float32Array.of(x, y, x + w, y, x + w, y + w * 0.6, x, y + w),
  fillRule: 'nonzero',
});

/** Every kind of node the walk treats differently, scattered over [0, 1000]². */
export function mixedScene(seed: number, composed: boolean): AnyScene {
  const r = rng(seed);
  const scene = createScene<unknown, string, unknown>({
    systemLayers: [{ id: 'back', parallax: { pan: 0.25 } }, { id: 'main' }],
    composition: composed ? RIGID_POSE_COMPOSITION as never : IDENTITY_POSE_COMPOSITION,
  });
  const id = (s: string) => asNodeId(s);
  const at = () => ({ x: r() * 900, y: r() * 900 });
  const add = (spec: Record<string, unknown>) => scene.add({ kind: 'mark', layer: 'main', data: null, ...spec } as never);

  for (let i = 0; i < 40; i++) {
    const { x, y } = at();
    const pose: Record<string, unknown> = { x, y, width: 5 + r() * 80, height: 5 + r() * 80 };
    if (i % 2 === 0) pose.rotation = r() * Math.PI * 2;
    if (i % 7 === 3) pose.transform = [1, 0.6, -0.3, 1.4];
    const data = i % 3 === 0 ? null : { shape: i % 3 === 1 ? 'rect' : 'ellipse', fill: SOLID, grow: (i % 5) * 15 };
    add({ id: id(`r${i}`), pose, data });
  }
  for (let i = 0; i < 6; i++) {
    const { x, y } = at();
    add({
      id: id(`gon${i}`), pose: { x, y, width: 60, height: 60, rotation: i * 0.4 },
      data: { shape: 'polygon', sides: 24, fill: i % 2 ? SOLID : null, stroke: { paint: INK, width: 3 } },
    });
  }
  for (let i = 0; i < 4; i++) {
    const { x, y } = at();
    add({
      id: id(`px${i}`), pose: { x, y, width: 50, height: 30, ...(i % 2 ? { rotation: 0.7 } : {}) },
      data: { shape: 'rect', fill: null, stroke: { paint: INK, width: { px: 6 } } },
    });
    add({
      id: id(`outer${i}`), pose: { x: y, y: x, width: 40, height: 40 },
      data: { shape: i % 2 ? 'ellipse' : 'rect', fill: null, stroke: { paint: INK, width: 8, align: 'outer' } },
    });
  }
  for (let i = 0; i < 3; i++) {
    const { x, y } = at();
    add({ id: id(`path${i}`), pose: square(x, y, 50) });
  }
  // Connectors between pairs of rects; the pose is a placeholder at the origin.
  for (let i = 0; i < 4; i++) {
    add({
      id: id(`edge${i}`), pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { stroke: { paint: INK, width: 4 } },
      dependsOn: [id(`r${i * 2}`), id(`r${i * 2 + 5}`)],
      derivePath: (_n: unknown, deps: readonly ({ pose: { x: number; y: number } } | undefined)[]) => {
        const [a, b] = [deps[0]?.pose, deps[1]?.pose];
        return a && b ? linePath({ x: a.x, y: a.y }, { x: b.x, y: b.y }) : null;
      },
    });
  }
  const clip = add({
    id: id('clip'), kind: 'group', pose: { x: 600, y: 600, width: 100, height: 100, rotation: 0.3 },
    clipFromPose: (p: { x: number; y: number; width: number; height: number }) =>
      ({ kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height }),
  });
  add({ id: id('clip.in'), parent: clip, pose: { x: 620, y: 620, width: 30, height: 30 }, data: { shape: 'rect', fill: SOLID } });
  add({ id: id('clip.out'), parent: clip, pose: { x: 670, y: 650, width: 90, height: 40, rotation: 0.5 } });
  const copies: Affine[] = [translate(300, 0), rotateAboutPoint(200, 200, 1.1)];
  const copy = add({
    id: id('copy'), kind: 'group', pose: { x: 100, y: 100, width: 0, height: 0 },
    copiesFromPose: () => copies, clipFromPose: () => null,
  });
  add({ id: id('copy.a'), parent: copy, pose: { x: 120, y: 130, width: 40, height: 20 }, data: { shape: 'rect', fill: SOLID } });
  const frame = add({ id: id('frame'), kind: 'group', pose: { x: 300, y: 300, width: 200, height: 100, rotation: Math.PI / 3 }, clipFromPose: () => null });
  add({ id: id('frame.a'), parent: frame, pose: { x: 320, y: 310, width: 40, height: 30, rotation: 0.2 } });
  add({ id: id('frame.b'), parent: frame, pose: { x: 10, y: 20, width: 30, height: 30 } });
  for (let i = 0; i < 15; i++) {
    const { x, y } = at();
    add({ id: id(`hill${i}`), layer: 'back', pose: { x, y, width: 20 + r() * 100, height: 20 + r() * 60, rotation: r() } });
  }

  scene.setLocked(id('r1'), true);
  scene.setLocked(id('gon1'), true);
  scene.setHidden(id('r4'), true);
  scene.setHidden(id('hill2'), true);
  scene.overrides.set(id('r7'), { alpha: 0 });
  scene.overrides.set(id('r8'), { alpha: 0.4 });
  scene.overrides.set(id('r10'), { pose: { x: 950, y: 40, width: 60, height: 30, rotation: 0.9 } });
  scene.overrides.commit();
  return scene as AnyScene;
}
