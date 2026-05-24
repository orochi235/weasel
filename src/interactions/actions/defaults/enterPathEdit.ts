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

import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Scene, NodeId } from 'core/scene/types';

export const enterPathEditAction: Action & { requires: string[] } = {
  id: 'enterPathEdit',
  label: 'Edit path anchors',
  // Double-click on a polygon body (selected OR unselected) — matches the
  // Figma/Illustrator convention where double-clicking a path enters edit
  // mode regardless of prior selection state. The `kindOf` predicate fires
  // on either body class but not on empty space, so a double-click on
  // empty canvas doesn't accidentally enter edit mode.
  defaultBinding: {
    kind: 'doubleClick',
    target: {
      kindOf: (_target: unknown, bodyTarget?: string): boolean =>
        bodyTarget === 'selected-body' || bodyTarget === 'unselected-body',
    },
  },
  requires: ['editAnchors', 'selection', 'scene'],
  invoker: {
    timing: 'immediate',
    run(deps) {
      const editAnchors = deps.editAnchors as EditAnchorsDep | undefined;
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      if (!editAnchors || !selection || !scene) return;
      const ids = selection.get() as NodeId[];
      for (const id of ids) {
        const node = scene.get(id);
        if (node && (node.pose as { kind?: string })?.kind === 'polygon') {
          editAnchors.setEditingId(id);
          return;
        }
      }
    },
  } as ImmediateInvoker,
  enabled: () => true,
};
