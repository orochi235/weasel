/**
 * The active fill and stroke, on the kit's `FillStrokeSwatch`. A pick paints
 * the active paint and, through `setFill`/`setStroke`, the selection — live
 * while the picker is open, one undo entry when it closes.
 *
 * Keybindings (registered in `tools/colorContext/actions.ts`):
 *   D     reset to default — black stroke, white fill
 *   X     swap fill/stroke colors
 *   /     set the last-focused swatch to none
 */
import type { ReactElement } from 'react';
import {
  DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, mergeAlphaFromPrev, useOngoingAction,
  type FillStyle,
} from '@weasel-js/core';
import { FillStrokeSwatch } from '@weasel-js/ui';
import { useColorContext } from './tools/colorContext';

export type ActivePaint =
  | { kind: 'solid'; color: string }
  | { kind: 'none' }
  | { kind: 'transparent' };

export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: DEFAULT_FILL_COLOR };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

function toFillStyle(p: ActivePaint): FillStyle | null {
  if (p.kind === 'none') return null;
  return { fill: 'solid', color: p.kind === 'solid' ? p.color : '#00000000' };
}

export function ActiveSwatches(): ReactElement {
  const colors = useColorContext();
  const edits = { fill: useOngoingAction('setFill'), stroke: useOngoingAction('setStroke') };

  // The native picker has no alpha, so a pick keeps the paint's own.
  const pick = (slot: 'fill' | 'stroke', color: string): string => {
    const cur = slot === 'fill' ? colors.fill : colors.stroke;
    const prev = cur.kind === 'solid' ? cur.color
      : slot === 'fill' ? DEFAULT_FILL_COLOR : DEFAULT_STROKE_COLOR;
    const merged = mergeAlphaFromPrev(color, prev);
    if (slot === 'fill') colors.setFill({ kind: 'solid', color: merged });
    else colors.setStroke({ kind: 'solid', color: merged });
    return merged;
  };

  return (
    <FillStrokeSwatch
      className="wd-active-swatches"
      fill={toFillStyle(colors.fill)}
      stroke={toFillStyle(colors.stroke)}
      focused={colors.focused}
      onFocusChange={colors.setFocus}
      onInput={(slot, color) => edits[slot].input({ color: pick(slot, color) })}
      onChange={(slot) => edits[slot].commit()}
      onToggleNone={(slot) => {
        colors.setFocus(slot);
        const set = slot === 'fill' ? colors.setFill : colors.setStroke;
        const cur = slot === 'fill' ? colors.fill : colors.stroke;
        set(cur.kind === 'none' ? (slot === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE) : { kind: 'none' });
      }}
      onSwap={colors.swap}
      shortcuts={{ none: '/', swap: 'X' }}
    />
  );
}
