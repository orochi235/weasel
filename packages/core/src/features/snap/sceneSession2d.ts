import type { ResizeAnchor } from '@weasel-js/routing';
import type { View } from '@weasel-js/geom';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import type { Scene } from 'core/scene/types';
import type { PlaneMap } from 'core/viewport/parallax';
import type { OriginProjection } from 'interactions/gestures/shared/originProjection';
import { drawnBoxes, type DrawnBoxes } from 'interactions/actions/drawnBoxes';
import type { SnapBegin, SnapConstrain, SnapGeometry, SnapResizeBox, SnapSession } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore, type SnapOutcomeStore } from './outcomeStore';
import { buildProbes, resizeSubjectOf, subjectBox } from './probes2d';
import { sceneProbeReads, withSubtrees } from './sceneReads';
import { createSession2d, DEFAULT_SNAP_PX } from './session2d';
import type { SnapGesture, SnapSource } from './types';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

/** What a session over a scene runs on: its subject's probes and boxes come
 *  from `scene`, measured through `boxes`. */
export interface SceneSessionInputs {
  req: SnapBegin;
  scene: AnyScene;
  boxes: DrawnBoxes;
  sources: readonly SnapSource[];
  view(): View | null;
  reachPx: number;
  store: SnapOutcomeStore;
  geometryAt?: (press: Point, ids: readonly string[]) => Point | null;
  /** How a pose's origin is read. Default `AUTO_ORIGIN_PROJECTION`. */
  originProjection?: OriginProjection<unknown>;
  onEnd?: () => void;
}

/** A 2D session whose probes are the subject's, read from the scene at press. */
export function sceneSession2d(i: SceneSessionInputs): SnapSession {
  const reads = sceneProbeReads({
    scene: i.scene, boxes: i.boxes,
    ...(i.geometryAt ? { geometryAt: i.geometryAt } : {}),
    ...(i.originProjection ? { originProjection: i.originProjection } : {}),
  });
  return createSession2d({
    req: i.req,
    sources: i.sources,
    probes: buildProbes(i.req, reads),
    box: i.req.ids ? subjectBox(i.req.ids, reads) : null,
    resize: resizeSubjectOf(i.req, reads),
    drawnBox: (id) => {
      const pose = reads.pose(id);
      return pose === undefined ? undefined : reads.drawnBox(id, pose);
    },
    ...(i.req.ids ? { exclude: withSubtrees(i.scene, i.req.ids) } : {}),
    view: i.view,
    reachPx: i.reachPx,
    scene: i.scene,
    store: i.store,
    ...(i.onEnd ? { onEnd: i.onEnd } : {}),
  });
}

/** Options for {@link createSnapSession2d}. */
export interface SnapSession2dOptions {
  scene: AnyScene;
  /** The camera the reach is measured through. */
  view: View;
  sources: readonly SnapSource[];
  gesture: SnapGesture;
  /** World coords. */
  press: Point;
  /** The subject, whose geometry offers no targets. */
  ids?: readonly string[];
  /** Point gestures: the previous anchor, a line's start. */
  origin?: Point;
  constrain?: SnapConstrain;
  /** Resize: the sides the drag pins. */
  handle?: ResizeAnchor;
  /** Resize: the box `handle` belongs to. Default: the subjects' drawn box. */
  box?: SnapResizeBox;
  also?: SnapGeometry;
  /** The reach of a source that sets none, in screen px. Default `DEFAULT_SNAP_PX`. */
  reachPx?: number;
  /** Where the session writes its marks. Default: a store of its own. */
  store?: SnapOutcomeStore;
  /** How poses are read. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<unknown>;
  /** Whether drawn boxes include the stroke. Default `true`. */
  boundsIncludeStroke?: boolean;
  /** How a pose's origin, the point a grid or a guide snaps, is read.
   *  Default `AUTO_ORIGIN_PROJECTION`: a rect's `{x, y}`, a path's bounds. */
  originProjection?: OriginProjection<unknown>;
  /** How `view`'s world maps into the parallax plane the gesture's points
   *  are in. Default: they are in `view`'s own world. */
  plane?: PlaneMap | null;
}

/**
 * One gesture's snapping over a scene, for a host without `<SceneCanvas>`:
 * the session a canvas's `snap` dep begins, built from the same probes and
 * drawn boxes. Call `at` with each world point the gesture reaches, and
 * `end` when it lets go.
 */
export function createSnapSession2d(opts: SnapSession2dOptions): SnapSession {
  const view = opts.view;
  const req: SnapBegin = {
    gesture: opts.gesture,
    press: opts.press,
    ...(opts.ids ? { ids: opts.ids } : {}),
    ...(opts.origin ? { origin: opts.origin } : {}),
    ...(opts.constrain ? { constrain: opts.constrain } : {}),
    ...(opts.handle ? { handle: opts.handle } : {}),
    ...(opts.box ? { box: opts.box } : {}),
    ...(opts.also ? { also: opts.also } : {}),
    ...(opts.plane ? { plane: () => opts.plane ?? null } : {}),
  };
  return sceneSession2d({
    req,
    scene: opts.scene,
    boxes: drawnBoxes({
      scene: opts.scene,
      view: { get: () => view, set: () => {} },
      ...(opts.poseDescriptor ? { poseDescriptor: opts.poseDescriptor } : {}),
      ...(opts.boundsIncludeStroke !== undefined ? { boundsIncludeStroke: opts.boundsIncludeStroke } : {}),
    }),
    sources: opts.sources,
    view: () => view,
    reachPx: opts.reachPx ?? DEFAULT_SNAP_PX,
    store: opts.store ?? createSnapOutcomeStore(),
    ...(opts.originProjection ? { originProjection: opts.originProjection } : {}),
  });
}
