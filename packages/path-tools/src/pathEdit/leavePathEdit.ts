/**
 * `leavePathEditAction` — immediate Action that leaves path-anchor edit
 * mode. Bound to Escape by default; companion to `enterPathEditAction`.
 * Clears `editAnchors.editingId`, which the gesture-side hit-test and
 * `pathEditingOverlayLayer` both gate on. Pressed with a tool on other than
 * the mode's default (path edit's `anchors`), it returns to that tool instead.
 *
 * Disabled when it would do neither, so Escape falls through to the next binding.
 */

import { ActionDisabledReason, modeDefaultToReturnTo, returnToModeDefault, type Action } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';

export const leavePathEditAction: Action & { requires: string[] } = {
  id: 'leavePathEdit',
  label: 'Leave path edit',
  defaultBinding: [{ spec: { kind: 'key', key: 'Escape' }, opts: { id: 'leavePathEdit.key' } }],
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
  enabled: (deps) =>
    deps?.editAnchors?.editingId || modeDefaultToReturnTo(deps) !== null ? true : ActionDisabledReason.NotApplicable,
};
