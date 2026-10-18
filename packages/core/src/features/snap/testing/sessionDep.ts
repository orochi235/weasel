import { PATH_SNAP_KINDS, type PathSnapKind, type PolygonPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { drawnBoxes } from 'interactions/actions/drawnBoxes';
import type { SnapDep } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from '../outcomeStore';
import { sceneSession2d } from '../sceneSession2d';
import type { SnapSource } from '../types';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Grid lines every `step` on both axes, for origin and pointer probes. */
export function gridSource(step: number): SnapSource {
  return {
    id: 'grid', tier: 'fallback', reachPx: Infinity, roles: ['origin', 'pointer'],
    *collect(q) {
      for (const p of q.probes) {
        yield { probe: p.id, locus: { at: { x: Math.round(p.at.x / step) * step, y: p.at.y }, dirs: [{ x: 0, y: 1 }] } };
        yield { probe: p.id, locus: { at: { x: p.at.x, y: Math.round(p.at.y / step) * step }, dirs: [{ x: 1, y: 0 }] } };
      }
    },
  };
}

/** One line through `at` along `dir`, for pointer probes: a ruler guide. */
export function lineSource(at: Point, dir: Point): SnapSource {
  return {
    id: `line:${at.x},${at.y}`, roles: ['pointer'],
    *collect(q) {
      for (const p of q.probes) yield { probe: p.id, locus: { at, dirs: [dir] } };
    },
  };
}

/** `pathSnapSource`'s `kinds` with only anchors on. */
export const ANCHORS_ONLY = Object.fromEntries(PATH_SNAP_KINDS.map((k) => [k, k === 'anchor'])) as Record<PathSnapKind, boolean>;

/** A scene holding one leaf per path, on layer `main`, posed as the path. */
export function sceneOfPaths(paths: readonly PolygonPath[]): AnyScene {
  const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] }) as unknown as AnyScene;
  for (const pose of paths) scene.add({ kind: 'leaf', layer: 'main', data: {}, pose } as never);
  return scene;
}

/** A `snap` dep whose sessions run `sources` over `scene` at a zoom of
 *  `scale` (default 1), with an 8px reach, writing marks to `store`. */
export function sessionDep(
  scene: AnyScene, sources: readonly SnapSource[], scale = 1, store = createSnapOutcomeStore(),
): SnapDep {
  const view = { ...VIEW, scale: { x: scale, y: scale } };
  return {
    point: (p) => p,
    begin: (req) => sceneSession2d({ req, scene, boxes: drawnBoxes({ scene }), sources, view: () => view, reachPx: 8, store }),
  };
}
