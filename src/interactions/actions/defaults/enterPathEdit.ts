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
  // Double-click on a selected polygon body — matches the Figma/Illustrator
  // convention. The selected-body target ensures we don't enter edit mode on
  // empty-canvas double-clicks.
  defaultBinding: { kind: 'doubleClick', target: 'selected-body' },
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
