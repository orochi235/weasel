/** Extend to next path: carry an open end along its tangent until it meets a stroke. */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  extendToMeet, openEndAt, openEndRay, openPathEnds, pathDistanceToPoint, pathToAnchors,
  type AnchorSet, type OpenPathEnd, type PolygonPath,
} from '@weasel-js/geom';
import { commitOps, type Op, type PathNode, reshapeOps, selectedPathNodes, pathOperationTags } from '@weasel-js/core';
import { pressOf, scenePathNodes, strokesBesides, type StrokePress } from '../shared/scenePaths';
import { icon } from '../icons.gen';

const EXTEND_LABEL = 'Extend to next path';

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

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** The topmost stroke within reach of `press` with an open end, and that end
 *  of it nearest the press. */
function endNearPress(all: readonly PathNode[], press: StrokePress) {
  for (let i = all.length - 1; i >= 0; i--) {
    const node = all[i];
    if (pathDistanceToPoint(node.path, press.at.x, press.at.y) > press.radius) continue;
    const near = openPathEnds(node.path)
      .map((end) => ({ end, ray: openEndRay(node.path, end) }))
      .filter((e) => e.ray)
      .sort((a, b) => dist(a.ray!.at, press.at) - dist(b.ray!.at, press.at))[0];
    if (near) return [{ node, ends: [near.end] }];
  }
  return [];
}

/** What Extend to next path would make of each node it reaches. */
function planExtend(deps: ActionDeps | undefined, params?: unknown): Map<string, { node: PathNode; path: PolygonPath }> {
  const out = new Map<string, { node: PathNode; path: PolygonPath }>();
  const all = scenePathNodes(deps);
  const editing = deps?.editAnchors?.editingId;
  const press = deps ? pressOf(deps, params) : null;
  const subjects = press ? endNearPress(all, press) : editing
    ? all.filter((n) => n.id === editing).map((node) => ({ node, ends: endsAt(node.path, deps!.editAnchors!.selectedAnchors) }))
    : selectedPathNodes(deps).map((node) => ({ node, ends: openPathEnds(node.path) }));
  for (const { node, ends } of subjects) {
    const boundaries = strokesBesides(deps, node.id);
    let path = node.path;
    for (const end of ends) path = extendToMeet(path, boundaries, end)?.path ?? path;
    if (path !== node.path) out.set(node.id, { node, path });
  }
  return out;
}

/**
 * Extend to next path: carry each open end of the selected
 * paths along its tangent to the first stroke it meets (`extendToMeet`). In
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
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const ops: Op[] = [];
      for (const { node, path } of planExtend(deps, params).values()) ops.push(...reshapeOps(node.node, path, EXTEND_LABEL));
      commitOps(deps, ops, EXTEND_LABEL);
    },
  } satisfies ImmediateInvoker,
  // A click's point arrives here without the binding's reach, so `run` decides there.
  enabled: (deps?: ActionDeps, at?: { x: number; y: number }) =>
    (at || planExtend(deps).size > 0 ? true : ActionDisabledReason.NotApplicable),
};
