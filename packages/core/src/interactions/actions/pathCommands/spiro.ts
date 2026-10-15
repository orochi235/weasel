/**
 * Commands on spiro nodes (`spiroShape`): set the kind of the points selected
 * in path edit, and convert a spiro curve to an ordinary path.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { SPIRO_KINDS, isSpiroKind, type SpiroKind } from '@weasel-js/geom';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createSetDataOp } from 'core/ops/setData';
import { resolveEditablePathOf, storeEditablePath } from 'features/paths/editablePath';
import { respiroWithKind, spiroOf, withoutSpiro } from 'features/paths/spiroShape';
import { commitOps, nodeShapeOps, type AnyNode } from './pathNodes';

const KIND_LABELS: Record<SpiroKind, string> = {
  smooth: 'Smooth spiro point',
  corner: 'Corner spiro point',
  left: 'Spiro point after a line',
  right: 'Spiro point before a line',
};

/** The spiro node being edited in path edit, or null. */
function editedSpiro(deps: ActionDeps | undefined): AnyNode | null {
  const id = deps?.editAnchors?.editingId;
  const node = id ? (deps?.scene?.get(id as NodeId) as AnyNode | undefined) : undefined;
  return node && spiroOf(node.data) ? node : null;
}

/** The ops giving the selected points of the edited spiro the kind `kind`,
 *  or null when that changes nothing. */
function setKindOps(deps: ActionDeps | undefined, kind: SpiroKind, label: string): Op[] | null {
  const node = editedSpiro(deps);
  const selected = deps?.editAnchors?.selectedAnchors;
  const world = node ? resolveEditablePathOf(node) : null;
  if (!node || !world || !selected || selected.size === 0) return null;
  const solved = respiroWithKind(world, spiroOf(node.data)!, selected, kind);
  if (!solved) return null;
  const stored = storeEditablePath({ pose: node.pose, data: withoutSpiro(node.data) }, solved.path);
  if (!stored) return null;
  return nodeShapeOps(node, { pose: stored.pose, data: { ...(stored.data as object), spiro: solved.spiro } }, label);
}

const kindOf = (params: Record<string, unknown> | undefined): SpiroKind =>
  (isSpiroKind(params?.kind) ? params.kind : 'smooth');

/**
 * @experimental In path edit on a spiro curve, give the selected points the
 * kind `params.kind` (default `'smooth'`) and solve the curve again. One
 * variant per kind.
 */
export const setSpiroKindAction: Action & { requires: string[] } = {
  id: 'setSpiroKind',
  label: 'Set spiro point kind',
  group: 'spiro',
  variants: SPIRO_KINDS.map((kind) => ({ key: kind, label: KIND_LABELS[kind], params: { kind } })),
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const kind = kindOf(params);
      const ops = setKindOps(deps, kind, KIND_LABELS[kind]);
      if (ops) commitOps(deps, ops, KIND_LABELS[kind]);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) =>
    (editedSpiro(deps) && deps?.editAnchors?.selectedAnchors.size ? true : ActionDisabledReason.SelectionRequired),
};

/** The selected spiro nodes, or the one in path edit. */
function spiroTargets(deps: ActionDeps | undefined): AnyNode[] {
  const edited = deps?.editAnchors?.editingId;
  const ids = edited ? [edited] : (deps?.selection?.get() ?? []);
  return ids.flatMap((id) => {
    const node = deps?.scene?.get(id as NodeId) as AnyNode | undefined;
    return node && spiroOf(node.data) ? [node] : [];
  });
}

const RELEASE_LABEL = 'Convert to path';

/**
 * @experimental Convert the selected spiro curves, or the one in path edit, to
 * ordinary paths: the curve stays as drawn and its anchors and handles become
 * editable, while the spiro points stop being solved. Path edit's anchor
 * selection is cleared, since the anchors it numbered are gone.
 */
export const releaseSpiroAction: Action & { requires: string[] } = {
  id: 'releaseSpiro',
  label: RELEASE_LABEL,
  group: 'spiro',
  requires: ['selection', 'scene', 'applyOps', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const nodes = spiroTargets(deps);
      if (nodes.length === 0) return;
      commitOps(deps, nodes.map((node) => createSetDataOp({
        id: node.id, from: node.data, to: withoutSpiro(node.data), label: RELEASE_LABEL,
      })), RELEASE_LABEL);
      if (deps.editAnchors?.editingId) deps.editAnchors.setSelectedAnchors([]);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => (spiroTargets(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired),
};
