import type { PolygonPath, SpiroPoint } from '@weasel-js/geom';
import type { DragSample } from '@weasel-js/routing';

/**
 * Per-kind extra geometry passed to `InsertDep.commit`.
 *
 * Built-in tools populate a typed variant so the kit's default factory can
 * render the true tool params (line endpoints, polygon side count, star
 * geometry, pencil sample list). Consumer-defined tools may pass any
 * `{ kind: string; ... }` payload; the kit's factory falls back to AABB
 * inscription for unknown kinds.
 *
 * `bounds` is still passed alongside as a useful AABB pose hint — factories
 * may use it as the node's pose even when richer geometry is available.
 */
export type InsertExtras =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'line'; a: { x: number; y: number }; b: { x: number; y: number } }
  | { kind: 'polygon'; sides: number; rotation: number; center?: { x: number; y: number }; radius?: number }
  | { kind: 'star'; points: number; innerRadiusRatio: number; rotation: number; center?: { x: number; y: number }; outerRadius?: number }
  | { kind: 'pencil'; samples: ReadonlyArray<DragSample> }
  | { kind: 'text'; text?: string }
  /** A finished path in world coords, as the pen tool commits one. `bounds`
   *  is its AABB. An open path takes no fill. */
  | { kind: 'path'; path: PolygonPath; closed: boolean }
  /** A spiro curve through `points`, as the spiro tool commits one. The kit
   *  solves it into `data.path` and records the points in `data.spiro`. An
   *  open curve takes no fill. */
  | { kind: 'spiro'; points: SpiroPoint[]; closed: boolean }
  | {
      kind: 'image';
      src?: string;
      opacity?: number;
      /** Chrome-only: what the in-flight drag paints. Read by the overlay
       *  layer, ignored by the insert dep. */
      preview?: 'bitmap' | 'outline';
    }
  | { kind: string; [extra: string]: unknown };
