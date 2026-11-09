/** Extend to next path: carry an open end on until it meets a stroke. */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  anchorAt, anchorsToPath, DEG_TO_RAD, distance, editAnchorSetTracked, extendToMeet, lengthenPathEnd, openEndAt, openEndRay,
  openPathEnds, pathDistanceToPoint, pathEndAnchorIndex, pathToAnchors,
  type AnchorSet, type ExtendToMeetOptions, type OpenPathEnd, type PenAnchor, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import { pref } from '@weasel-js/prefs';
import { commitOps, type Op, type PathNode, reshapeOps, selectedPathNodes, pathOperationTags } from '@weasel-js/core';
import { pressOf, scenePathNodes, strokeReachPref, strokesBesides, type StrokePress } from '../shared/scenePaths';
import { icon } from '../icons.gen';

const EXTEND_LABEL = 'Extend to next path';

/** What the `extendToMeet` action reads from its params. */
export type ExtendToMeetParams = {
  /** The curve an end travels along: easing out of its bend into a straight
   *  run, or straight on along its tangent. Default `'eased'`. */
  shape?: 'eased' | 'straight';
  /** How far, in radians, an eased end turns before it runs straight. Default π/6. */
  easeTurn?: number;
  /** How far, in screen px, a click reaches for the stroke it extends. Default 6. */
  radiusPx?: number;
};

/** Extend to next path's params as a form, for the last-operation panel. */
export const EXTEND_TO_MEET_PARAMS = pref.group(EXTEND_LABEL, {
  shape: pref.enum<'eased' | 'straight'>('Shape', 'eased', [
    { value: 'eased', label: 'Eased' },
    { value: 'straight', label: 'Straight' },
  ], { description: 'Ease a curved end out of its bend, or carry it straight on along its tangent.', control: 'radio' }),
  easeTurn: pref.number('Ease turn', 30 * DEG_TO_RAD, {
    description: 'How far an eased end keeps turning before it runs straight.',
    min: 5 * DEG_TO_RAD, max: 90 * DEG_TO_RAD, step: DEG_TO_RAD, control: 'slider', unit: { scale: DEG_TO_RAD, suffix: '°', precision: 0 },
  }),
  radiusPx: strokeReachPref(),
});

/** `params` as `extendToMeet` options. */
function extendOptions(params: unknown): ExtendToMeetOptions {
  const p = (params ?? {}) as ExtendToMeetParams;
  if (p.shape === 'straight') return { mode: 'tangent' };
  const turn = p.easeTurn;
  return typeof turn === 'number' && Number.isFinite(turn) && turn > 0 ? { mode: 'eased', easeTurn: turn } : { mode: 'eased' };
}

/** The open ends of `path` whose anchors are in `anchors`, flat-indexed;
 *  every open end when none of the anchors is one. */
function endsAt(path: PolygonPath, anchors: ReadonlySet<number>): OpenPathEnd[] {
  const ends = openPathEnds(path);
  if (anchors.size === 0) return ends;
  const set = pathToAnchors(path) as AnchorSet;
  const at = [...anchors].map((flat) => openEndAt(set, flat));
  const picked = ends.filter((e) => at.some((o) => o?.sub === e.sub && o.end === e.end));
  return picked.length > 0 ? picked : ends;
}

/** The topmost stroke within reach of `press` with an open end, and that end
 *  of it nearest the press. */
function endNearPress(all: readonly PathNode[], press: StrokePress) {
  for (let i = all.length - 1; i >= 0; i--) {
    const node = all[i];
    if (pathDistanceToPoint(node.path, press.at.x, press.at.y) > press.radius) continue;
    const near = openPathEnds(node.path)
      .map((end) => ({ end, ray: openEndRay(node.path, end) }))
      .filter((e) => e.ray)
      .sort((a, b) => distance(a.ray!.at, press.at) - distance(b.ray!.at, press.at))[0];
    if (near) return [{ node, ends: [near.end] }];
  }
  return [];
}

/** What Extend to next path makes of one node: its path, where its anchors came from, and the flat indexes of
 *  `selected` once the ends have grown, an end anchor following its end. */
interface Extended {
  node: PathNode;
  path: PolygonPath;
  origins: readonly (PointOrigin | null)[];
  selected: number[];
}

/** Carry each of `ends` on to meet `boundaries`, as one edit of `path`; null when none meets anything. */
function extendEnds(
  path: PolygonPath, boundaries: Parameters<typeof extendToMeet>[1], ends: readonly OpenPathEnd[],
  opts: ExtendToMeetOptions, selected: ReadonlySet<number>,
): Omit<Extended, 'node'> | null {
  let after: number[] = [];
  const next = editAnchorSetTracked(path, (set) => {
    const kept = new Map<PenAnchor, OpenPathEnd | null>();
    for (const flat of selected) {
      const anchor = anchorAt(set, flat);
      if (anchor) kept.set(anchor, openEndAt(set, flat));
    }
    let changed = false;
    for (const end of ends) {
      const met = extendToMeet(anchorsToPath(set.anchors, set.closed, path), boundaries, end, opts);
      if (met && lengthenPathEnd(set, end, met.distance, opts.mode ?? 'eased', opts)) changed = true;
    }
    const flatOf = new Map(set.anchors.flat().map((a, k) => [a, k]));
    after = [...kept].flatMap(([anchor, end]) => {
      const at = end ? pathEndAnchorIndex(set, end) : flatOf.get(anchor) ?? -1;
      return at >= 0 ? [at] : [];
    });
    return changed;
  });
  return next && { ...next, selected: [...new Set(after)].sort((a, b) => a - b) };
}

/** What Extend to next path would make of each node it reaches. */
function planExtend(deps: ActionDeps | undefined, params?: unknown): Map<string, Extended> {
  const out = new Map<string, Extended>();
  const all = scenePathNodes(deps);
  const editing = deps?.editAnchors?.editingId;
  const press = deps ? pressOf(deps, params) : null;
  const opts = extendOptions(params);
  const subjects = press ? endNearPress(all, press) : editing
    ? all.filter((n) => n.id === editing).map((node) => ({ node, ends: endsAt(node.path, deps!.editAnchors!.selectedAnchors) }))
    : selectedPathNodes(deps).map((node) => ({ node, ends: openPathEnds(node.path) }));
  for (const { node, ends } of subjects) {
    if (node.path.kind !== 'polygon') continue;
    const selected = node.id === editing ? deps!.editAnchors!.selectedAnchors : new Set<number>();
    const next = extendEnds(node.path, strokesBesides(deps, node.id), ends, opts, selected);
    if (next) out.set(node.id, { node, ...next });
  }
  return out;
}

/**
 * Extend to next path: carry each open end of the selected paths to the first
 * stroke it meets (`extendToMeet`), easing a curved end out of its bend unless
 * `params.shape` is `'straight'` ({@link ExtendToMeetParams}). In
 * path edit, the selected end anchors of the edited path, or all its open
 * ends when none is selected. Given a press (`press`, as a click
 * binding supplies), the open end nearest it of the topmost stroke within
 * `radiusPx` instead. An end that meets nothing stays put. One undo step.
 */
export const extendToMeetAction: Action & { requires: string[] } = {
  id: 'extendToMeet',
  icon: icon('extend'),
  label: EXTEND_LABEL,
  tags: pathOperationTags('click'),
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps', 'editAnchors', 'view'],
  params: EXTEND_TO_MEET_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const plan = planExtend(deps, params);
      const dep = deps.editAnchors;
      const edited = dep?.editingId ? plan.get(dep.editingId) : undefined;
      if (dep && edited && plan.size === 1) {
        // The edited path goes through path edit, so what its extensions keep per anchor follows the anchors.
        dep.applyEdit(dep.editingId, edited.path, EXTEND_LABEL, edited.origins);
        dep.setSelectedAnchors(edited.selected);
        return;
      }
      const ops: Op[] = [];
      for (const { node, path } of plan.values()) ops.push(...reshapeOps(node, path, EXTEND_LABEL));
      commitOps(deps, ops, EXTEND_LABEL);
    },
  } satisfies ImmediateInvoker,
  // A click's point arrives here without the binding's reach, so `run` decides there. `enabled` is not
  // handed the params a run would use, so either shape reaching a stroke enables it.
  enabled: (deps?: ActionDeps, at?: { x: number; y: number }) =>
    (at || planExtend(deps).size > 0 || planExtend(deps, { shape: 'straight' }).size > 0
      ? true : ActionDisabledReason.NotApplicable),
};
