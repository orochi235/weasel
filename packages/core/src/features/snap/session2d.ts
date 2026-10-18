import { closestOnFlat, resolveSnap, type Flat, type SnapCandidate } from '@weasel-js/geom/nd';
import type { View } from '@weasel-js/geom';
import type { Scene } from 'core/scene/types';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { SnapBegin, SnapOutcome, SnapSession } from 'interactions/actions/snapDep';
import { inputFlat } from './inputSubspace';
import type { SnapOutcomeStore } from './outcomeStore';
import type { SnapGesture, SnapMark, SnapProbeAt, SnapSource, SourceCandidate } from './types';

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
  /** The subject's drawn box at press, for an aspect lock. */
  box?: Bounds | null;
  view(): View | null;
  /** The reach of a source that sets none, in screen px. */
  reachPx: number;
  scene?: Scene<unknown, string, unknown>;
  store: SnapOutcomeStore;
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
      const input = inputFlat(req, mods, delta0, inputs.box);
      if (mods.suspend) {
        store.set([]);
        return outcome(req.press, closestOnFlat(input, [delta0.x, delta0.y]), false, []);
      }
      const view = inputs.view();
      const res = resolveSnap({
        probes: inputs.probes.map((q) => ({ id: q.id, at: [q.at.x, q.at.y], role: q.role })),
        input,
        delta0: [delta0.x, delta0.y],
        candidates: collectAll(inputs, sources, delta0, view),
        toScreen: screenOf(view),
      });
      const delta = { x: res.delta[0], y: res.delta[1] };
      const marks = res.satisfied.flatMap((c) => (c.mark ? [typeof c.mark === 'function' ? c.mark(delta) : c.mark] : []));
      store.set(marks);
      return outcome(req.press, res.delta, res.members.length > 0, marks);
    },
    angle: (theta) => ({ theta, marks: [] }),
    end() {
      store.set([]);
      inputs.onEnd?.();
    },
  };
}

function screenOf(view: View | null): (w: readonly number[]) => readonly number[] {
  if (!view) return (w) => w;
  const t = viewToTransform(view);
  return ([x, y]) => worldToScreen(x, y, t);
}

function outcome(press: Point, delta: readonly number[], held: boolean, marks: readonly SnapMark[]): SnapOutcome {
  return { point: { x: press.x + delta[0], y: press.y + delta[1] }, held, marks };
}

function collectAll(
  inputs: Session2dInputs, sources: readonly SnapSource[], delta0: Point, view: View | null,
): SnapCandidate<SourceMark>[] {
  const { req } = inputs;
  const scale = view ? Math.min(Math.abs(view.scale.x), Math.abs(view.scale.y)) : 1;
  const out: SnapCandidate<SourceMark>[] = [];
  sources.forEach((source, order) => {
    const offered = inputs.probes
      .filter((q) => source.roles.includes(q.role))
      .map((q) => ({ ...q, at: { x: q.at.x + delta0.x, y: q.at.y + delta0.y } }));
    if (offered.length === 0) return;
    const ids = new Set(offered.map((q) => q.id));
    const found = source.collect({
      gesture: req.gesture, probes: offered, exclude: req.ids ?? [],
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

function toFlat(locus: { at: Point; dirs: readonly Point[] }): Flat {
  return { at: [locus.at.x, locus.at.y], dirs: locus.dirs.map((d) => [d.x, d.y]) };
}
