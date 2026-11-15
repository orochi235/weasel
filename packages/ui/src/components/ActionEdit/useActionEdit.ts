import { useMemo } from 'react';
import { useLatest, useOngoingAction, type InvokeParams } from '@weasel-js/core';
import type { EditCallbacks } from '../../useEditDraft';

/**
 * Edit callbacks that run the ongoing action `actionId`, for any control keeping the kit's edit protocol
 * (`docs/conventions.md`, "Edit callbacks"): a `Slider`, an `InlineRange` (as `onValueInput`, `onValueChange` and
 * `onValueCancel`), a curve or a paint editor. `toParams` turns the control's value into the action's params.
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
): Required<EditCallbacks<V>> {
  const edit = useOngoingAction(actionId);
  const map = useLatest(toParams);
  return useMemo(() => ({
    onInput: (value: V) => edit.input(map.current(value)),
    onChange: (value: V) => edit.commit(map.current(value)),
    onCancel: () => edit.cancel(),
  }), [edit, map]);
}
