import type { KeyboardEvent } from 'react';
import { CONTROL_SELECTOR } from '@weasel-js/core';
import { arrowDir } from '@weasel-js/ui-input';
import { inlineDirection } from './useRovingTabIndex';

/** Takes the controls in a row's control cell out of the tab order: the row is the list's one tab stop. */
export function untabControls(cell: ParentNode): void {
  cell.querySelectorAll(CONTROL_SELECTOR).forEach((c) => c.setAttribute('tabindex', '-1'));
}

/** Left, Right and Escape in a grid row's control cell: from the row's own cell, the arrow toward the controls
 *  enters them; from a control, the arrows step across them, and back out to the row's cell past the first.
 *  Returns whether focus moved into the controls or along them. */
export function walkControls(e: KeyboardEvent<HTMLElement>, controlCell: HTMLElement, target: HTMLElement, onTarget: boolean): boolean {
  const controls = Array.from(controlCell.querySelectorAll<HTMLElement>(CONTROL_SELECTOR))
    .filter((c) => !c.matches(':disabled'));
  const by = arrowDir(e.key, { orientation: 'horizontal', dir: inlineDirection(e.currentTarget) });
  if (onTarget) {
    if (by !== 1 || !controls[0]) return false;
    e.preventDefault();
    controls[0].focus();
    return true;
  }
  e.preventDefault();
  const at = controls.findIndex((c) => c.contains(e.target as Node));
  if (by === 1) controls[at + 1]?.focus();
  else if (by === -1 && at > 0) controls[at - 1]?.focus();
  else target.focus();
  return true;
}
