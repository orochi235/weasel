import type { SelectIntent } from '@weasel-js/select';

/** Whether a press with `intent` adds to the selection rather than replacing it. */
export function extendsSelection(intent: SelectIntent): boolean {
  return intent === 'toggle' || intent === 'range';
}

/**
 * Whether a press must leave the node selection alone because extend-clicks
 * are locked (`UseSelectToolOptions.extendClickLocked`). Shift is locked
 * whatever the selection reads it as: the anchor edit that sets the lock
 * claims Shift-click for its own selection.
 */
export function extendPressLocked(intent: SelectIntent, shift: boolean, locked: () => boolean): boolean {
  return (extendsSelection(intent) || shift) && locked();
}
