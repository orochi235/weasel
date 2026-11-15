import { useMemo } from 'react';
import { useLatest, useOngoingAction, type InvokeParams } from '@weasel-js/core';
import { useEditDraft, type EditCallbacks } from '../../useEditDraft';

/** What {@link useActionEdit} hands a control: the edit callbacks, and the value to draw. */
export type ActionEdit<V> = Required<EditCallbacks<V>> & {
  /** `value`, or while an edit runs, where the edit has reached: an action previews on the canvas, not in `value`. */
  shown: V;
};

/**
 * Edit callbacks that run the ongoing action `actionId`, for any control keeping the kit's edit protocol
 * (`docs/conventions.md`, "Edit callbacks"): a `Slider`, an `InlineRange` (as `onValueInput`, `onValueChange` and
 * `onValueCancel`), a paint or a curve editor. `toParams` turns the control's value into the action's params, and
 * `value` is what the control edits; draw `shown`.
 *
 * `onInput` begins the action on an edit's first preview and moves it on each one after, `onChange` ends it, and
 * `onCancel` ends it unkept, so one drag is one run of the action and one undo step, with no coalescing window.
 * A key step, which the protocol reports as a preview and its commit, is a run and an undo step of its own, as a
 * nudge is.
 *
 * With no action reachable all three do nothing, as `useOngoingAction`'s handle does.
 */
export function useActionEdit<Id extends string, V>(
  actionId: Id,
  toParams: (value: V) => InvokeParams<Id>,
  value: NoInfer<V>,
): ActionEdit<V> {
  const edit = useOngoingAction(actionId);
  const map = useLatest(toParams);
  const draft = useEditDraft<V>(value, { onChange: (v) => edit.commit(map.current(v)), onCancel: () => edit.cancel() });
  const { onInput: drawInput, onChange, onCancel } = draft;
  const callbacks = useMemo(() => ({
    onInput: (v: V) => {
      drawInput(v);
      edit.input(map.current(v));
    },
    onChange,
    onCancel,
  }), [edit, map, drawInput, onChange, onCancel]);
  return { ...callbacks, shown: draft.shown };
}
