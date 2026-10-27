import { findPathSnap, findPathSnaps, PATH_SNAP_KINDS, type PathSnapKind } from '@weasel-js/geom';
import type { Scene } from 'core/scene/types';
import { DEFAULT_SNAP_PX } from 'domains/snap/session2d';
import type { SnapSource } from 'domains/snap/types';
import { PATH_SNAP_LABELS } from './glyphs';
import { sceneSnapIndex } from './sceneIndex';

type Point = { x: number; y: number };

/** Options for `pathSnapSource`. */
export interface PathSnapSourceOptions {
  /** The kinds offered. Default: every kind. */
  only?: readonly PathSnapKind[];
  /** Kinds to turn on or off. A kind not named is on. */
  kinds?: Partial<Record<PathSnapKind, boolean>>;
  /** Overrides the canvas's reach for path targets, in screen px. */
  reachPx?: number;
}

/**
 * The scene's paths as snap targets: a point for every enabled kind of
 * target in range of a pointer or geometry probe. `nearest` is offered only
 * when no other kind is in range of that probe. Tangent and perpendicular
 * targets need the query's `origin`.
 */
export function pathSnapSource(opts: PathSnapSourceOptions = {}): SnapSource {
  const kinds = (opts.only ?? PATH_SNAP_KINDS).filter((k) => opts.kinds?.[k] !== false);
  return {
    id: 'path-snap',
    roles: ['pointer', 'geometry'],
    ...(opts.reachPx !== undefined ? { reachPx: opts.reachPx } : {}),
    *collect(q) {
      if (!q.scene) return;
      const { ids, index } = sceneSnapIndex(q.scene, q.also);
      const exclude = new Set(q.exclude);
      const include = q.include ? new Set(q.include) : null;
      const radius = q.reachWorld(opts.reachPx ?? q.reachPx);
      const skip = (i: number) => {
        const id = ids[i];
        if (id === null) return false;
        return exclude.has(id) || (include ? !include.has(id) : false);
      };
      for (const p of q.probes) {
        const hits = findPathSnaps(index, p.at, { radius, kinds, skip, ...(q.origin ? { origin: q.origin } : {}) });
        for (const h of hits) {
          const at = { x: h.x, y: h.y };
          yield {
            probe: p.id,
            locus: { at, dirs: [] },
            mark: { kind: 'point', at, glyph: h.kind, label: PATH_SNAP_LABELS[h.kind] },
          };
        }
      }
    },
  };
}

/** The point of the nodes `ids`' own geometry nearest `press`, within
 *  `reachPx` screen px, or null: where a move's `geometry` probe sits. Leaves
 *  no mark. */
export function ownGeometryAt(
  scene: Pick<Scene<unknown, string, unknown>, 'nodes' | 'layers' | 'getVersion'>,
  press: Point,
  ids: readonly string[],
  scale: { x: number; y: number },
  reachPx = DEFAULT_SNAP_PX,
): Point | null {
  const { ids: owners, index } = sceneSnapIndex(scene);
  const own = new Set(ids);
  const hit = findPathSnap(index, press, {
    radius: reachPx,
    scale,
    skip: (i) => {
      const id = owners[i];
      return id !== null && !own.has(id);
    },
  });
  return hit ? { x: hit.x, y: hit.y } : null;
}
