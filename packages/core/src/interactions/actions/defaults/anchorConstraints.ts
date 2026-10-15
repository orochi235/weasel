/**
 * Add and remove geometric constraints on the anchors selected in path edit.
 * Neither has a default binding: a consumer binds each kind it offers, with
 * the kind as a param (see `<SceneCanvas tune>`).
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  constraintAnchors,
  pathAnchorPoints,
  type AnchorPair,
  type PathConstraint,
  type PathConstraintKind,
  type PolygonPath,
} from '@weasel-js/geom';
import { constraintsOf } from 'features/paths/pathConstraints';
import type { EditAnchorsDep } from '../depSchema';
import { depOf } from './anchorEditing';
import { editedPath } from './constraintMarks';

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
 * ask for: each anchor for `fixed`; each consecutive pair for `horizontal`,
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
    return dep?.setConstraints && dep.selectedAnchors.size > 0 ? dep : null;
  };
  return {
    id,
    label,
    group: 'anchors',
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = ready(deps);
        const list = dep && next(dep, params);
        if (dep && list) dep.setConstraints!(dep.editingId, list, label);
      },
    } as ImmediateInvoker,
    enabled: (deps) => (ready(deps) ? true : ActionDisabledReason.SelectionRequired),
  };
}

/**
 * Delete the constraint whose mark was clicked. Bound to Delete and
 * Backspace beside `deleteAnchors`, which is disabled while a constraint
 * rather than anchors is selected, so each key reaches the one selected.
 */
export const deleteConstraintAction: Action & { requires: string[] } = {
  id: 'deleteConstraint',
  label: 'Delete constraint',
  defaultBinding: {
    kind: 'key',
    key: ['Delete', 'Backspace'],
    phase: [{ channel: '*', phase: 'initial' }],
  },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      const index = dep?.selectedConstraint;
      if (!dep?.setConstraints || index == null) return;
      const current = constraintsOf(dep.getNodeShape(dep.editingId)?.data);
      if (index >= current.length) return;
      dep.setConstraints(dep.editingId, current.filter((_, i) => i !== index), 'Delete constraint');
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const dep = depOf(deps);
    return dep?.setConstraints && dep.selectedConstraint != null ? true : ActionDisabledReason.SelectionRequired;
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
