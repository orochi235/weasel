/**
 * `enterPathEditAction` — immediate Action that enters path-anchor edit
 * mode on a double-click against a selected polygon. Sets
 * `editAnchors.editingId` to the first selected polygon's id; the
 * gesture-side hit-test (via `buildAffordanceAt`) and the
 * `pathEditingOverlayLayer` chrome both gate on that id.
 *
 * A selected path effect hiding its sources edits its path source.
 *
 * No-op when the selection contains no polygon. The companion
 * `leavePathEditAction` (Escape) clears edit mode.
 */

import type { NodeId } from '@weasel-js/core';
import { ActionDisabledReason, defineAction, isBody, type ActionDeps } from '@weasel-js/routing';
import { effectSourceFor } from '@weasel-js/core';
import type {} from '../actionParamSchema';

/** The path entering edit at `world` would open: the one under the pointer, else the first selected node with
 *  an editable path. Null when there is none, so the double-click is left to the next binding. */
function pathEditTarget(deps: ActionDeps | undefined, world: { x: number; y: number } | undefined): string | null {
  const editAnchors = deps?.editAnchors;
  const selection = deps?.operands;
  if (!editAnchors || !selection) return null;
  // The path under the pointer wins: with several selected, the first may not be the one double-clicked.
  const under = world ? deps.nodeAtPoint?.(world) : null;
  if (under && editAnchors.getEditablePath(under)) return under;
  const scene = deps.scene;
  // Use the dep's editability check rather than poking at node.pose directly — the dep knows whether a node has
  // an editable polygon (pose-as-polygon OR data.path) so this picks up both shapes.
  for (const id of selection.get() as NodeId[]) {
    // An effect hiding its path edits that path when entered from the selection. A double-click never does: on the
    // effect's glyphs it is the text's, and between them it is aimed at nothing.
    const target = (!world && scene ? effectSourceFor(scene, id, 'path') : null) ?? id;
    if (editAnchors.getEditablePath(target)) return target;
  }
  return null;
}

export const enterPathEditAction = defineAction({
  id: 'enterPathEdit',
  label: 'Edit path anchors',
  // Double-click on a polygon body (selected OR unselected) — matches the
  // Figma/Illustrator convention where double-clicking a path enters edit
  // mode regardless of prior selection state. The `kindOf` predicate fires
  // on either body class but not on empty space, so a double-click on
  // empty canvas doesn't accidentally enter edit mode.
  defaultBinding: [{
    spec: {
      kind: 'doubleClick',
      target: { kindOf: isBody },
    },
    opts: { id: 'enterPathEdit.doubleClick' },
  }],
  eligible: { mode: 'normal' },
  requires: ['editAnchors', 'operands', 'nodeAtPoint', 'hitAt', 'scene'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const target = pathEditTarget(deps, params?.world);
      if (target !== null) deps.editAnchors!.setEditingId(target);
    },
  },
  // A double-click naming a group above the path under it is the group's, not this action's.
  enabled: (deps, at) => {
    if (at && deps?.hitAt?.(at)?.doubleClick) return ActionDisabledReason.NotApplicable;
    return pathEditTarget(deps, at) !== null ? true : ActionDisabledReason.NotApplicable;
  },
});
