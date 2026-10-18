/**
 * Add and remove geometric constraints on the anchors selected in path edit.
 * Neither has a default binding: a consumer binds each kind it offers, with
 * the kind as a param (see `<SceneCanvas tune>`).
 */

import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  constraintAnchors,
  pathAnchorPoints,
  segmentBetween,
  type AnchorPair,
  type PathConstraint,
  type PathConstraintKind,
  type PolygonPath,
} from '@weasel-js/geom';
import { depOf, deleteSelectedMark, type EditAnchorsDep, pathOperationTags } from '@weasel-js/core';
import { constraintsOf } from './pathConstraints';
import { editedPath, selectedConstraintOf, setConstraints } from './constraintsExtension';
import { icon } from '../icons.gen';

/** Params for `constrainAnchors`. */
export interface ConstrainAnchorsParams {
  kind: PathConstraintKind;
  /** For `length`: the length to hold. Default: each pair's length now. */
  length?: number;
}

const pairsOf = (anchors: readonly number[]): AnchorPair[] =>
  anchors.slice(1).map((b, i) => [anchors[i], b] as const);

/** Two segments from three anchors, meeting at the middle one, or from four, as two pairs. */
function segmentPair(anchors: readonly number[]): readonly [AnchorPair, AnchorPair] | null {
  if (anchors.length === 3) return [[anchors[0], anchors[1]], [anchors[1], anchors[2]]];
  if (anchors.length === 4) return [[anchors[0], anchors[1]], [anchors[2], anchors[3]]];
  return null;
}

/**
 * The constraints of `kind` that `anchors`, in the order they were selected,
 * ask for: each anchor for `fixed`; each anchor with both handles for
 * `tangent`; for `onPath`, three anchors, the first held on the segment the
 * other two end; each consecutive pair for `horizontal`,
 * `vertical`, `length`, and `coincident`; and for the kinds relating two
 * segments, three anchors as two segments sharing the middle one or four as
 * two pairs. Empty when the anchors cannot make that kind.
 */
export function constraintsForAnchors(
  kind: PathConstraintKind,
  anchors: readonly number[],
  path: PolygonPath,
  length?: number,
): PathConstraint[] {
  switch (kind) {
    case 'fixed': return anchors.map((anchor) => ({ kind, anchor }));
    case 'onPath': {
      const segment = anchors.length === 3 ? segmentBetween(path, anchors[1], anchors[2]) : null;
      return segment ? [{ kind, anchor: anchors[0], segment }] : [];
    }
    case 'tangent': {
      const points = pathAnchorPoints(path);
      return anchors.filter((a) => points[a]?.inHandle && points[a]?.outHandle).map((anchor) => ({ kind, anchor }));
    }
    case 'horizontal':
    case 'vertical': return pairsOf(anchors).map((segment) => ({ kind, segment }));
    case 'coincident': return pairsOf(anchors).map((pair) => ({ kind, anchors: pair }));
    case 'length': {
      const points = pathAnchorPoints(path);
      return pairsOf(anchors).map((segment) => ({
        kind,
        segment,
        length: length ?? Math.hypot(points[segment[1]].x - points[segment[0]].x, points[segment[1]].y - points[segment[0]].y),
      }));
    }
    default: {
      const segments = segmentPair(anchors);
      return segments ? [{ kind, segments }] : [];
    }
  }
}

const sameConstraint = (a: PathConstraint, b: PathConstraint) => JSON.stringify(a) === JSON.stringify(b);

/** The constraints adding `params` to the edited path's would leave it with, or null for no change. */
function withAdded(dep: EditAnchorsDep, params: Partial<ConstrainAnchorsParams> | undefined): PathConstraint[] | null {
  const path = editedPath(dep);
  if (!path || !params?.kind) return null;
  const current = constraintsOf(dep.getNodeShape(dep.editingId)?.data);
  const added = constraintsForAnchors(params.kind, [...dep.selectedAnchors], path, params.length)
    .filter((c) => !current.some((had) => sameConstraint(had, c)));
  return added.length > 0 ? [...current, ...added] : null;
}

/** The constraints left once those on only selected anchors, of `kind` when given, are gone; null for no change. */
function withRemoved(dep: EditAnchorsDep, kind: PathConstraintKind | undefined): PathConstraint[] | null {
  const current = constraintsOf(dep.getNodeShape(dep.editingId)?.data);
  const kept = current.filter((c) =>
    (kind !== undefined && c.kind !== kind) || !constraintAnchors(c).every((a) => dep.selectedAnchors.has(a)));
  return kept.length < current.length ? kept : null;
}

function constraintCommand(
  id: string,
  label: string,
  next: (dep: EditAnchorsDep, params: Record<string, unknown> | undefined) => PathConstraint[] | null,
): Action & { requires: string[] } {
  const ready = (deps: ActionDeps | undefined) => {
    const dep = depOf(deps);
    return dep?.store && dep.selectedAnchors.size > 0 ? dep : null;
  };
  return {
    id,
    label,
    group: 'anchors',
    tags: pathOperationTags('drag'),
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = ready(deps);
        const list = dep && next(dep, params);
        if (dep && list) setConstraints(dep, list, label);
      },
    } as ImmediateInvoker,
    enabled: (deps) => (ready(deps) ? true : ActionDisabledReason.SelectionRequired),
  };
}

/**
 * Delete the constraint selected in path edit, as a command. Delete and
 * Backspace reach it through `deleteAnchors`, which deletes whichever of the
 * two is selected, so the keys have one binding.
 */
export const deleteConstraintAction: Action & { requires: string[] } = {
  id: 'deleteConstraint',
  label: 'Delete constraint',
  icon: icon('core:delete'),
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      if (dep && selectedConstraintOf(dep) !== null) deleteSelectedMark(dep);
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    return dep?.store && selectedConstraintOf(dep) !== null ? true : ActionDisabledReason.SelectionRequired;
  },
};

/**
 * Constrain the selected anchors: params `{ kind, length? }`, read as
 * {@link constraintsForAnchors} reads them. The path moves the least that
 * makes every constraint hold; a constraint that conflicts with the rest is
 * kept all the same, left unsolved, and shown as a conflict.
 */
export const constrainAnchorsAction = constraintCommand(
  'constrainAnchors',
  'Constrain anchors',
  (dep, params) => withAdded(dep, params as Partial<ConstrainAnchorsParams> | undefined),
);

/**
 * Remove the constraints whose anchors are all selected — only those of
 * `kind` when the params name one.
 */
export const unconstrainAnchorsAction = constraintCommand(
  'unconstrainAnchors',
  'Remove constraints',
  (dep, params) => withRemoved(dep, params?.kind as PathConstraintKind | undefined),
);
