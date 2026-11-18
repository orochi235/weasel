/**
 * The active fill and stroke, on the kit's `FillStrokeSwatch`. An edit in a
 * chip's paint editor paints the active paint and, through `setFill`/`setStroke`,
 * the selection — live while it runs, one undo entry when it ends.
 *
 * Keybindings (`colorContribution` in `tools/colorContext`):
 *   D        reset to default — black stroke, white fill
 *   X        swap fill/stroke colors
 *   Shift+X  swap which swatch has focus
 *   /        set the last-focused swatch to none
 */
import type { ReactElement } from 'react';
import { useOngoingAction, type Paint } from '@weasel-js/core';
import { FillStrokeSwatch } from '@weasel-js/ui/components/FillStrokeSwatch';
import { useColorContext } from './tools/colorContext';

export function ActiveSwatches(): ReactElement {
  const colors = useColorContext();
  const edits = { fill: useOngoingAction('setFill'), stroke: useOngoingAction('setStroke') };

  const paint = (slot: 'fill' | 'stroke', next: Paint | null): void => {
    if (slot === 'fill') colors.setFill(next);
    else colors.setStroke(next);
  };

  return (
    <FillStrokeSwatch
      className="wd-active-swatches"
      fill={colors.fill}
      stroke={colors.stroke}
      target={colors.focused}
      onTargetChange={colors.setFocus}
      onInput={(slot, next) => {
        paint(slot, next);
        edits[slot].input({ paint: next });
      }}
      onChange={(slot, next) => {
        paint(slot, next);
        edits[slot].commit({ paint: next });
      }}
      onToggleNone={(slot) => {
        colors.setFocus(slot);
        colors.toggleNone(slot);
      }}
      onSwap={colors.swap}
      shortcuts={{ none: '/', swap: 'X' }}
    />
  );
}
