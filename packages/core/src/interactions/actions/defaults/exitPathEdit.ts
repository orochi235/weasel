/**
 * `exitPathEditAction` — immediate Action that exits path-anchor edit
 * mode. Bound to Escape by default; companion to `enterPathEditAction`.
 * Clears `editAnchors.editingId`, which the gesture-side hit-test and
 * `pathEditingOverlayLayer` both gate on. Pressed with a tool on other than
 * the mode's default (path edit's `anchors`), it returns to that tool instead.
 *
 * Always enabled — calling it when no path is being edited is a no-op.
 */

import { returnToModeDefault, type Action } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';

export const exitPathEditAction: Action & { requires: string[] } = {
  id: 'exitPathEdit',
  label: 'Exit path edit',
  defaultBinding: [{ spec: { kind: 'key', key: 'Escape' }, opts: { id: 'exitPathEdit.key' } }],
  eligible: { mode: 'path-edit' },
  requires: ['editAnchors', 'activeTool', 'modeDefaultTool'],
  invoker: {
    timing: 'immediate',
    run(deps) {
      if (returnToModeDefault(deps)) return;
      const editAnchors = deps.editAnchors;
      editAnchors?.setEditingId(null);
    },
  } as ImmediateInvoker,
  enabled: () => true,
};
