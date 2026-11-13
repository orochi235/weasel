import { ActionDisabledReason, BETWEEN_GESTURES, isBody, type Action, type ImmediateInvoker, type ImmediateParams } from '@weasel-js/routing';

/**
 * Opens the top-most text node at the pointer in place, the caret at the glyph
 * there, through the `textEdit` dep. It declines where no text is under the
 * pointer, and where the double-click names a group above the text, whose own
 * double-click enters it, as `enterPathEdit` declines there. `enterTextEdit`
 * opens the selection instead.
 */
export const editTextAtAction: Action & { requires: string[] } = {
  id: 'editTextAt',
  label: 'Edit text here',
  defaultBinding: [{
    spec: { kind: 'doubleClick', target: { kindOf: isBody }, phase: BETWEEN_GESTURES },
    opts: { id: 'editTextAt.doubleClick' },
  }],
  eligible: { mode: 'normal' },
  requires: ['textEdit', 'hitAt'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const world = (params as ImmediateParams | undefined)?.world;
      const hit = world ? deps.textEdit?.textAt(world) : null;
      if (hit) deps.textEdit!.startEdit(hit.id, { caret: hit.caret });
    },
  } as ImmediateInvoker,
  enabled: (deps, at) => {
    if (!at || deps?.hitAt?.(at)?.doubleClick) return ActionDisabledReason.NotApplicable;
    return deps?.textEdit?.textAt(at) ? true : ActionDisabledReason.NotApplicable;
  },
};
