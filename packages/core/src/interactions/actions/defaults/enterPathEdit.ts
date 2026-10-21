/**
 * `enterPathEditAction` — immediate Action that enters path-anchor edit
 * mode on a double-click against a selected polygon. Sets
 * `editAnchors.editingId` to the first selected polygon's id; the
 * gesture-side hit-test (via `buildAffordanceAt`) and the
 * `pathEditingOverlayLayer` chrome both gate on that id.
 *
 * No-op when the selection contains no polygon. The companion
 * `exitPathEditAction` (Escape) clears edit mode.
 */

import type { Action } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { ActionDisabledReason, isBody } from '@weasel-js/routing';

export const enterPathEditAction: Action & { requires: string[] } = {
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
  eligible: { mode: { in: ['normal', 'isolation'] } },
  requires: ['editAnchors', 'selection', 'nodeAtPoint', 'hitAt'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const editAnchors = deps.editAnchors;
      const selection = deps.selection;
      if (!editAnchors || !selection) return;
      // The path under the pointer wins: with several selected, the first may not be the one
      // double-clicked.
      const x = params?.worldX, y = params?.worldY;
      const under = typeof x === 'number' && typeof y === 'number' ? deps.nodeAtPoint?.({ x, y }) : null;
      if (under && editAnchors.getEditablePath(under)) {
        editAnchors.setEditingId(under);
        return;
      }
      const ids = selection.get() as NodeId[];
      // Use the dep's editability check rather than poking at node.pose
      // directly — the dep knows whether a node has an editable polygon
      // (pose-as-polygon OR data.path) so this picks up both shapes.
      for (const id of ids) {
        if (editAnchors.getEditablePath(id)) {
          editAnchors.setEditingId(id);
          return;
        }
      }
    },
  } as ImmediateInvoker,
  // A double-click naming a group above the path under it is the group's, not this action's.
  enabled: (deps, at) => (at && deps?.hitAt?.(at)?.doubleClick ? ActionDisabledReason.NotApplicable : true),
};
