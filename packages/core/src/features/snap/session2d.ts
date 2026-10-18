import { closestOnFlat, resolveSnap, type Flat, type SnapCandidate } from '@weasel-js/geom/nd';
import type { View } from '@weasel-js/geom';
import type { Scene } from 'core/scene/types';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { fromPlane, type PlaneMap } from 'core/viewport/parallax';
import type { SnapBegin, SnapOutcome, SnapSession } from 'interactions/actions/snapDep';
import { inputFlat } from './inputSubspace';
import { createSnapOutcomeStore, type SnapOutcomeStore } from './outcomeStore';
import { resizedBox, resizeEdges, resizeSubject, type ResizeSubject } from './resizeBox';
import type { SnapCollect, SnapGesture, SnapMark, SnapProbeAt, SnapSource, SourceCandidate } from './types';

type Point = { x: number; y: number };

/** The canvas's reach when neither a source nor the kit settings name one. */
export const DEFAULT_SNAP_PX = 8;

type SourceMark = NonNullable<SourceCandidate['mark']>;

const DEFAULT_GESTURES: readonly SnapGesture[] = ['point', 'move', 'resize'];

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
  store: SnapOutcomeStore;
  /** Nodes that offer no targets. Default `req.ids`. */
  exclude?: readonly string[];
  /** Runs after `end` clears the store. */
  onEnd?: () => void;
}

/** A snap session over a 2D canvas: ctx points are world points. */
export function createSession2d(inputs: Session2dInputs): SnapSession {
  const { req, store } = inputs;
  const sources = inputs.sources.filter((s) => (s.gestures ?? DEFAULT_GESTURES).includes(req.gesture));
  return {
    at(p, mods) {
      const delta0 = { x: p.x - req.press.x, y: p.y - req.press.y };
      const input = inputFlat(req, mods, delta0, inputs.resize);
      if (mods.suspend) {
        store.set([]);
        return outcome(req.press, closestOnFlat(input, [delta0.x, delta0.y]), false, []);
      }
      const view = inputs.view();
      const plane = req.plane?.() ?? null;
      const res = resolveSnap({
        probes: inputs.probes.map((q) => ({ id: q.id, at: [q.at.x, q.at.y], role: q.role })),
        input,
        delta0: [delta0.x, delta0.y],
        candidates: collectAll(inputs, sources, delta0, view, plane),
        toScreen: screenOf(view, plane),
      });
      const delta = { x: res.delta[0], y: res.delta[1] };
      const marks = distinct(res.satisfied.flatMap((c) => marksOf(c.mark, delta)));
      store.set(plane ? marks.map((m) => markFromPlane(m, plane)) : marks);
      return outcome(req.press, res.delta, res.members.length > 0, marks);
    },
    angle: (theta) => ({ theta, marks: [] }),
    end() {
      store.set([]);
      inputs.onEnd?.();
    },
  };
}

/** `marks` with repeats dropped, so a target several probes meet is drawn once. */
function distinct(marks: readonly SnapMark[]): SnapMark[] {
  const seen = new Set<string>();
  return marks.filter((m) => {
    const key = JSON.stringify(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function marksOf(mark: SourceMark | undefined, delta: Point): readonly SnapMark[] {
  if (!mark) return [];
  const m = typeof mark === 'function' ? mark(delta) : mark;
  return 'kind' in m ? [m] : m;
}

function screenOf(view: View | null, plane: PlaneMap | null): (w: readonly number[]) => readonly number[] {
  const t = view ? viewToTransform(view) : null;
  return ([x, y]) => {
    const w = plane ? fromPlane(plane, { x, y }) : { x, y };
    return t ? worldToScreen(w.x, w.y, t) : [w.x, w.y];
  };
}

/** `m` carried out of a plane into the camera's world, where the readout draws. */
function markFromPlane(m: SnapMark, plane: PlaneMap): SnapMark {
  const pt = (p: Point) => fromPlane(plane, p);
  return m.kind === 'point' ? { ...m, at: pt(m.at) } : { ...m, from: pt(m.from), to: pt(m.to) };
}

function outcome(press: Point, delta: readonly number[], held: boolean, marks: readonly SnapMark[]): SnapOutcome {
  return { point: { x: press.x + delta[0], y: press.y + delta[1] }, held, marks };
}

function collectAll(
  inputs: Session2dInputs, sources: readonly SnapSource[], delta0: Point, view: View | null, plane: PlaneMap | null,
): SnapCandidate<SourceMark>[] {
  const { req } = inputs;
  const camera = view ? Math.min(Math.abs(view.scale.x), Math.abs(view.scale.y)) : 1;
  // A plane unit is `plane.scale` camera units the other way round.
  const scale = plane ? camera / Math.max(Math.abs(plane.scale.x), Math.abs(plane.scale.y)) : camera;
  const out: SnapCandidate<SourceMark>[] = [];
  sources.forEach((source, order) => {
    const offered = inputs.probes
      .filter((q) => source.roles.includes(q.role))
      .map((q) => ({ ...q, at: { x: q.at.x + delta0.x, y: q.at.y + delta0.y } }));
    if (offered.length === 0) return;
    const ids = new Set(offered.map((q) => q.id));
    const found = source.collect({
      gesture: req.gesture, probes: offered, delta0, exclude: inputs.exclude ?? req.ids ?? [],
      ...(plane ? { plane } : {}),
      ...subjectAt(inputs, delta0),
      ...(inputs.drawnBox ? { drawnBox: inputs.drawnBox } : {}),
      ...(req.origin ? { origin: req.origin } : {}),
      ...(req.also ? { also: req.also } : {}),
      reachWorld: (px) => px / scale,
      reachPx: source.reachPx ?? inputs.reachPx,
      ...(inputs.scene ? { scene: inputs.scene } : {}),
    });
    for (const c of found) {
      if (!ids.has(c.probe)) continue;
      out.push({
        probe: c.probe, locus: toFlat(c.locus),
        ...(c.locus.span ? { span: c.locus.span } : {}),
        source: source.id, order, tier: source.tier ?? 'target',
        reachPx: source.reachPx ?? inputs.reachPx,
        ...(c.required ? { required: true } : {}),
        ...(c.mark ? { mark: c.mark } : {}),
      });
    }
  });
  return out;
}

/** The subject's box where `delta0` puts it, and the sides that moved. */
function subjectAt(inputs: Session2dInputs, delta0: Point): Pick<SnapCollect, 'box' | 'edges'> {
  if (inputs.resize) return { box: resizedBox(inputs.resize, delta0), edges: resizeEdges(inputs.resize) };
  const b = inputs.req.gesture === 'move' ? inputs.box : null;
  return b ? { box: { ...b, x: b.x + delta0.x, y: b.y + delta0.y } } : {};
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

function toFlat(locus: { at: Point; dirs: readonly Point[] }): Flat {
  return { at: [locus.at.x, locus.at.y], dirs: locus.dirs.map((d) => [d.x, d.y]) };
}
