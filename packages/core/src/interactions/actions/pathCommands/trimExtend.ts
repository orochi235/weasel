/**
 * Trim and Extend to Next Path: the drafting commands that cut a stroke back
 * to its crossings or carry an open end on until it meets one.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  extendToMeet, locateAnchor, openPathEnds, pathToAnchors, trimPathAt,
  type AnchorSet, type OpenPathEnd, type PolygonPath,
} from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { resolveEditablePathOf } from 'features/paths/editablePath';
import {
  commitOps, deleteNode, reshapeOps, selectedPathNodes, type AnyNode, type PathNode,
} from './pathNodes';

const TRIM_LABEL = 'Trim';
const EXTEND_LABEL = 'Extend to Next Path';

/** Default reach of a trim click from the stroke, in screen pixels. */
export const DEFAULT_TRIM_RADIUS_PX = 6;

/** Every leaf of the scene holding an editable path, back to front. */
export function scenePathNodes(deps: ActionDeps | undefined): PathNode[] {
  const scene = deps?.scene as { renderOrderNodes?(): readonly AnyNode[] } | undefined;
  const out: PathNode[] = [];
  for (const node of scene?.renderOrderNodes?.() ?? []) {
    if (node.kind !== 'leaf') continue;
    const path = resolveEditablePathOf(node);
    if (path) out.push({ id: node.id as NodeId, node, path });
  }
  return out;
}

/**
 * @experimental Trim the stroke under the press: remove its piece between
 * the nearest crossings on either side — with any other path in the scene,
 * or with itself — as `trimPathAt` cuts it. The topmost stroke within
 * `radiusPx` of the press (default {@link DEFAULT_TRIM_RADIUS_PX}) is the
 * one trimmed; a stroke with nothing left is deleted. Params: `pressX`,
 * `pressY` in world space, which a click binding supplies.
 */
export const trimPathAction: Action & { requires: string[] } = {
  id: 'trimPath',
  label: TRIM_LABEL,
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  requires: ['scene', 'applyOps', 'selection', 'view'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const p = params as { pressX?: number; pressY?: number; radiusPx?: number } | undefined;
      if (p?.pressX === undefined || p.pressY === undefined || !deps.scene) return;
      const probe = { x: p.pressX, y: p.pressY };
      const scale = deps.view?.get().scale ?? { x: 1, y: 1 };
      const radius = (p.radiusPx ?? DEFAULT_TRIM_RADIUS_PX) / Math.max(Math.abs(scale.x), Math.abs(scale.y));
      const all = scenePathNodes(deps);
      for (let i = all.length - 1; i >= 0; i--) {
        const target = all[i];
        const cutters = all.filter((n) => n !== target).map((n) => n.path);
        const r = trimPathAt(target.path, cutters, probe, { radius });
        if (!r) continue;
        const gone = r.path.commands.length === 0;
        const ops = gone
          ? [deleteNode(deps.scene as never, target.node, TRIM_LABEL)]
          : reshapeOps(target.node, r.path, TRIM_LABEL);
        commitOps(deps, ops, TRIM_LABEL);
        if (gone) deps.selection?.set((deps.selection.get() ?? []).filter((id) => id !== target.id) as never);
        return;
      }
    },
  } satisfies ImmediateInvoker,
  enabled: () => true,
};

/** The open ends of `path` whose anchors are in `anchors`, flat-indexed;
 *  every open end when none of the anchors is one. */
function endsAt(path: PolygonPath, anchors: ReadonlySet<number>): OpenPathEnd[] {
  const ends = openPathEnds(path);
  if (anchors.size === 0) return ends;
  const set = pathToAnchors(path) as AnchorSet;
  const picked = ends.filter((e) => [...anchors].some((flat) => {
    const at = locateAnchor(set, flat);
    if (!at || at.sub !== e.sub) return false;
    return e.end === 'first' ? at.idx === 0 : at.idx === set.anchors[at.sub].length - 1;
  }));
  return picked.length > 0 ? picked : ends;
}

/** What Extend to Next Path would make of each node it reaches. */
function planExtend(deps: ActionDeps | undefined): Map<string, { node: PathNode; path: PolygonPath }> {
  const out = new Map<string, { node: PathNode; path: PolygonPath }>();
  const all = scenePathNodes(deps);
  const editing = deps?.editAnchors?.editingId;
  const subjects = editing
    ? all.filter((n) => n.id === editing).map((node) => ({ node, ends: endsAt(node.path, deps!.editAnchors!.selectedAnchors) }))
    : selectedPathNodes(deps).map((node) => ({ node, ends: openPathEnds(node.path) }));
  for (const { node, ends } of subjects) {
    const boundaries = all.filter((n) => n.id !== node.id).map((n) => n.path);
    let path = node.path;
    for (const end of ends) path = extendToMeet(path, boundaries, end)?.path ?? path;
    if (path !== node.path) out.set(node.id, { node, path });
  }
  return out;
}

/**
 * @experimental Extend to Next Path: carry each open end of the selected
 * paths along its tangent to the first stroke it meets (`extendToMeet`). In
 * path edit, the selected end anchors of the edited path, or all its open
 * ends when none is selected. An end that meets nothing stays put. One undo
 * step.
 */
export const extendToMeetAction: Action & { requires: string[] } = {
  id: 'extendToMeet',
  label: EXTEND_LABEL,
  group: 'path',
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const plan = planExtend(deps);
      const ops: Op[] = [];
      for (const { node, path } of plan.values()) ops.push(...reshapeOps(node.node, path, EXTEND_LABEL));
      commitOps(deps, ops, EXTEND_LABEL);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps?: ActionDeps) => (planExtend(deps).size > 0 ? true : ActionDisabledReason.NotApplicable),
};
