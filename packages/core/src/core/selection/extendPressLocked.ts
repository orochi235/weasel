/**
 * Whether a press must leave the node selection alone because extend-clicks
 * are locked (`UseSelectToolOptions.extendClickLocked`). Shift is locked
 * whatever the selection reads it as: the anchor edit that sets the lock
 * claims Shift-click for its own selection.
 */
export function extendPressLocked(intent: string, shift: boolean, locked: () => boolean): boolean {
  return (intent !== 'replace' || shift) && locked();
}
