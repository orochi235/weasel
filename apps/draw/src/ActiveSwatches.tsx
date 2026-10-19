/**
 * The active fill and stroke, on the kit's `FillStrokeSwatch`. A pick paints
 * the active paint and, through `setFill`/`setStroke`, the selection — live
 * while the picker is open, one undo entry when it closes.
 *
 * Keybindings (`colorContribution` in `tools/colorContext`):
 *   D        reset to default — black stroke, white fill
 *   X        swap fill/stroke colors
 *   Shift+X  swap which swatch has focus
 *   /        set the last-focused swatch to none
 */
import type { ReactElement } from 'react';
import {
  DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, mergeAlphaFromPrev, useOngoingAction,
  type Paint,
} from '@weasel-js/core';
import { FillStrokeSwatch } from '@weasel-js/ui/components/FillStrokeSwatch';
import { solidColorOf } from '@weasel-js/ui/paint-value';
import { useColorContext } from './tools/colorContext';

/** The paint a new shape takes, as a node holds one: `null` is none. */
export type ActivePaint = Paint | null;

export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: DEFAULT_FILL_COLOR };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

export function ActiveSwatches(): ReactElement {
  const colors = useColorContext();
  const edits = { fill: useOngoingAction('setFill'), stroke: useOngoingAction('setStroke') };

  // The native picker has no alpha, so a pick keeps the paint's own.
  const withAlpha = (slot: 'fill' | 'stroke', color: string): string => {
    const cur = slot === 'fill' ? colors.fill : colors.stroke;
    const prev = solidColorOf(cur) ?? (slot === 'fill' ? DEFAULT_FILL_COLOR : DEFAULT_STROKE_COLOR);
    return mergeAlphaFromPrev(color, prev);
  };
  const pick = (slot: 'fill' | 'stroke', color: string): string => {
    const merged = withAlpha(slot, color);
    if (slot === 'fill') colors.setFill({ kind: 'solid', color: merged });
    else colors.setStroke({ kind: 'solid', color: merged });
    return merged;
  };

  return (
    <FillStrokeSwatch
      className="wd-active-swatches"
      fill={colors.fill}
      stroke={colors.stroke}
      focused={colors.focused}
      onFocusChange={colors.setFocus}
      onInput={(slot, color) => edits[slot].input({ color: pick(slot, color) })}
      onChange={(slot, color) => {
        edits[slot].commit();
        return withAlpha(slot, color);
      }}
      onToggleNone={(slot) => {
        colors.setFocus(slot);
        const set = slot === 'fill' ? colors.setFill : colors.setStroke;
        const cur = slot === 'fill' ? colors.fill : colors.stroke;
        set(cur === null ? (slot === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE) : null);
      }}
      onSwap={colors.swap}
      shortcuts={{ none: '/', swap: 'X' }}
    />
  );
}
