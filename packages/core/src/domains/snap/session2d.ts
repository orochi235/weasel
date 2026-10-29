import { closestOnFlat, resolveSnap, type SnapCandidate } from '@weasel-js/geom/nd';
import type { View, Point } from '@weasel-js/geom';
import type { DebugSink } from '@weasel-js/routing';
import type { Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PlaneMap } from 'core/viewport/parallax';
import type { SnapBegin, SnapOutcome, SnapSession } from 'interactions/actions/snapDep';
import { angleAt } from './angle2d';
import { inputFlat } from './inputSubspace';
import { gatherSnapCandidates, resolvedSnapMarks, snapSourcesFor, type SnapCandidateMark } from './gather';
import { recordSnapCandidates } from './debugCandidates';
import { markFromPlane } from './marks';
import { createSnapOutcomeStore, type SnapOutcomeStore } from './outcomeStore';
import { resizedBox, resizeSides, resizeSubject, type ResizeSubject } from './resizeBox';
import { screenOf } from './screen';
import type { SnapCollect, SnapFrame, SnapMark, SnapProbeAt, SnapSource } from './types';

/** The canvas's reach when neither a source nor the kit settings name one. */
export const DEFAULT_SNAP_PX = 8;

/** What a 2D session runs on, captured at press. */
export interface Session2dInputs {
  req: SnapBegin;
  /** In source order: earlier wins a full tie. */
  sources: readonly SnapSource[];
  /** At press. */
  probes: readonly SnapProbeAt[];
  /** A move's subject: its drawn box at press. */
  box?: Bounds | null;
  /** A resize's box and frame. */
  resize?: ResizeSubject | null;
  /** `id`'s drawn box now, for sources measuring the scene the way the
   *  subject's box was. */
  drawnBox?: (id: string) => Bounds | undefined;
  view(): View | null;
  /** The reach of a source that sets none, in screen px. */
  reachPx: number;
  scene?: Scene<unknown, string, unknown>;
  /** `id`'s world rotation, for angle targets; undefined for a node that
   *  cannot turn. */
  rotationOf?: (id: string) => number | undefined;
  /** `id`'s box frame, for sources that work in a container's axes. */
  frameOf?: (id: string) => SnapFrame | undefined;
  store: SnapOutcomeStore;
  /** Nodes that offer no targets. Default `req.ids`. */
  exclude?: readonly string[];
  /** Where each frame's candidates are recorded, cleared at `end`. */
  debug?: DebugSink;
}

/** A snap session over a 2D canvas: ctx points are world points. */
export function createSession2d(inputs: Session2dInputs): SnapSession {
  const { req, store } = inputs;
  const sources = snapSourcesFor(inputs.sources, req.gesture);
  const fixed = collectAtPress(inputs);
  return {
    at(p, mods) {
      const delta0 = { x: p.x - req.press.x, y: p.y - req.press.y };
      const input = inputFlat(req, mods, delta0, inputs.resize);
      if (mods.suspend) {
        store.set([]);
        inputs.debug?.clearSnap();
        return outcome(req.press, closestOnFlat(input, [delta0.x, delta0.y]), false, []);
      }
      const view = inputs.view();
      const plane = req.plane?.() ?? null;
      const subject = subjectAt(inputs, delta0);
      const candidates = collectAll(sources, inputs.probes, { ...fixed, ...subject }, { delta0, view, plane }, inputs.reachPx);
      const res = resolveSnap({
        probes: inputs.probes.map((q) => ({ id: q.id, at: [q.at.x, q.at.y], role: q.role })),
        input,
        delta0: [delta0.x, delta0.y],
        candidates,
        toScreen: screenOf(view, plane),
      });
      if (inputs.debug) recordSnapCandidates(inputs.debug, candidates, res.satisfied, inputs.probes, delta0, plane);
      const delta = { x: res.delta[0], y: res.delta[1] };
      const marks = resolvedSnapMarks(res.satisfied, delta);
      store.set(plane ? marks.map((m) => markFromPlane(m, plane)) : marks);
      return outcome(req.press, res.delta, res.members.length > 0, marks);
    },
    angle: (theta, mods) => angleAt(inputs, sources, theta, mods),
    end() {
      store.set([]);
      inputs.debug?.clearSnap();
    },
  };
}

function outcome(press: Point, delta: readonly number[], held: boolean, marks: readonly SnapMark[]): SnapOutcome {
  return { point: { x: press.x + delta[0], y: press.y + delta[1] }, held, marks };
}

/** What a source is told that holds from press to release. */
type FixedCollect = Pick<SnapCollect, 'gesture' | 'ids' | 'parent' | 'exclude' | 'drawnBox' | 'origin' | 'also' | 'scene' | 'frameOf'>;

/** What changes from one frame to the next. */
interface Frame {
  delta0: Point;
  view: View | null;
  plane: PlaneMap | null;
}

function collectAtPress(inputs: Session2dInputs): FixedCollect {
  const { req } = inputs;
  return {
    gesture: req.gesture,
    ...(req.ids ? { ids: req.ids } : {}),
    ...(req.parent !== undefined ? { parent: req.parent } : {}),
    exclude: inputs.exclude ?? req.ids ?? [],
    ...(inputs.drawnBox ? { drawnBox: inputs.drawnBox } : {}),
    ...(req.origin ? { origin: req.origin } : {}),
    ...(req.also ? { also: req.also } : {}),
    ...(inputs.scene ? { scene: inputs.scene } : {}),
    ...(inputs.frameOf ? { frameOf: inputs.frameOf } : {}),
  };
}

function collectAll(
  sources: readonly SnapSource[], probesAtPress: readonly SnapProbeAt[],
  fixed: FixedCollect & Pick<SnapCollect, 'box' | 'sides' | 'boxAt'>, { delta0, view, plane }: Frame, reachPx: number,
): SnapCandidate<SnapCandidateMark<Point>>[] {
  const camera = view ? Math.min(Math.abs(view.scale.x), Math.abs(view.scale.y)) : 1;
  // A camera unit is `plane.scale` plane units.
  const scale = plane ? camera / Math.max(Math.abs(plane.scale.x), Math.abs(plane.scale.y)) : camera;
  const probes = probesAtPress.map((q) => ({ ...q, at: { x: q.at.x + delta0.x, y: q.at.y + delta0.y } }));
  return gatherSnapCandidates(sources, probes, (_source, offered, sourceReach) => ({
    ...fixed, probes: offered, delta0,
    ...(plane ? { plane } : {}),
    reachWorld: (px) => px / scale,
    reachPx: sourceReach,
  }), { toVec: (p) => [p.x, p.y], reachPx, ...(fixed.origin ? { origin: fixed.origin } : {}) });
}

/** The subject's box where `delta0` puts it, the sides that move, and where
 *  any other move would put it. */
function subjectAt(
  { box, resize }: Pick<Session2dInputs, 'box' | 'resize'>, delta0: Point,
): Pick<SnapCollect, 'box' | 'sides' | 'boxAt'> {
  if (resize) {
    return { box: resizedBox(resize, delta0), sides: resizeSides(resize, delta0), boxAt: (d) => resizedBox(resize, d) };
  }
  if (!box) return {};
  const boxAt = (d: Point): Bounds => ({ ...box, x: box.x + d.x, y: box.y + d.y });
  return { box: boxAt(delta0), boxAt };
}

/** A session no source answers: it only holds the point to the gesture's
 *  input subspace, as when a host provides no `snap` dep. */
export function inputSession(req: SnapBegin): SnapSession {
  return createSession2d({
    req,
    sources: [],
    probes: [],
    resize: req.gesture === 'resize' && req.handle && req.box ? resizeSubject(req.box, req.handle) : null,
    view: () => null,
    reachPx: 0,
    store: createSnapOutcomeStore(),
  });
}
