/**
 * `exitPathEditAction` — immediate Action that exits path-anchor edit
 * mode. Bound to Escape by default; companion to `enterPathEditAction`.
 * Clears `editAnchors.editingId`, which the gesture-side hit-test and
 * `pathEditingOverlayLayer` both gate on.
 *
 * Always enabled — calling it when no path is being edited is a no-op.
 */

import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';

export const exitPathEditAction: Action & { requires: string[] } = {
  id: 'exitPathEdit',
  label: 'Exit path edit',
  defaultBinding: { kind: 'key', key: 'Escape' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run(deps) {
      const editAnchors = deps.editAnchors as EditAnchorsDep | undefined;
      editAnchors?.setEditingId(null);
    },
  } as ImmediateInvoker,
  enabled: () => true,
};
