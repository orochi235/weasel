import type { Rect } from '@weasel-js/geom';
import {
  centeredBaseline, clampTo, envNumber, envPx,
  type Constraints, type FontSpec, type MeasureEnv, type Measured, type TextExtent,
} from './measure';

/** A button's height and type scale. */
export type ButtonSize = 'sm' | 'md';

/**
 * What a button shows, as every target reads it. `I` is how a target names an icon (a React node, a glyph name);
 * measuring only asks whether one is there.
 */
export interface ButtonFace<I = unknown> {
  /** The text measured for the label. A label that is not text passes its text content, or `''`. Absent, the
   *  button has no label part. */
  readonly label?: string;
  /** Default `'md'`. */
  readonly size?: ButtonSize;
  /** The button is its icon alone, `icon`, in a square box. */
  readonly iconOnly?: boolean;
  readonly icon?: I;
  readonly leadingIcon?: I;
  readonly trailingIcon?: I;
  /** A spinner stands in for the leading icon (the icon, when `iconOnly`). */
  readonly loading?: boolean;
}

/** One piece of a button, in the order it is laid out. */
export type ButtonPart = 'spinner' | 'icon' | 'leading' | 'label' | 'trailing';

/** Which parts `face` shows, left to right. Both targets draw exactly these. */
export function buttonParts(face: ButtonFace): ButtonPart[] {
  if (face.iconOnly) return [face.loading ? 'spinner' : 'icon'];
  const out: ButtonPart[] = [];
  if (face.loading) out.push('spinner');
  else if (face.leadingIcon) out.push('leading');
  if (face.label !== undefined) out.push('label');
  if (face.trailingIcon) out.push('trailing');
  return out;
}

/** A button's sizes in px, read from its theme. */
export interface ButtonMetrics {
  readonly height: number;
  /** Inset of the content from each side. 0 on an icon-only button, which is square. */
  readonly padX: number;
  /** Between adjacent parts. */
  readonly gap: number;
  readonly iconSize: number;
  readonly spinnerSize: number;
  readonly font: FontSpec;
}

/** The spinner's drawn size at either button size. */
export const BUTTON_SPINNER_SIZE = 14;

/** The tokens a button of `size` is sized by: the same ones ui's `Button.module.css` lays it out with, so the DOM
 *  button and the HUD one agree in any theme. */
export function buttonMetrics(env: MeasureEnv, size: ButtonSize = 'md', iconOnly = false): ButtonMetrics {
  const sm = size === 'sm';
  const height = envPx(env, sm ? '--wzl-control-h-sm' : '--wzl-control-h');
  return {
    height,
    padX: iconOnly ? 0 : envPx(env, '--wzl-button-pad-x', sm ? '--wzl-space-4' : '--wzl-space-6'),
    gap: envPx(env, '--wzl-space-3'),
    iconSize: envPx(env, '--wzl-button-icon-size', sm ? 12 : 14),
    spinnerSize: BUTTON_SPINNER_SIZE,
    font: {
      family: env.token('--wzl-font-ui'),
      size: envPx(env, '--wzl-field-font-size', sm ? '--wzl-font-size-sm' : '--wzl-font-size'),
      weight: envNumber(env, '--wzl-button-font-weight', envNumber(env, '--wzl-font-weight-medium', 500)),
    },
  };
}

/** Where each of a button's parts sits. */
export interface ButtonLayout {
  readonly parts: readonly { readonly part: ButtonPart; readonly rect: Rect }[];
  readonly metrics: ButtonMetrics;
}

/**
 * A button's box: its control height, and its parts' widths plus gaps plus side padding (square when icon-only),
 * held to `c`. The parts are centered in the box, as flex centers them. In a box too narrow for them, the label
 * gives up width first, down to none.
 */
export function measureButton(face: ButtonFace, c: Constraints, env: MeasureEnv): Measured<ButtonLayout> {
  const m = buttonMetrics(env, face.size, face.iconOnly);
  const parts = buttonParts(face);
  let text: TextExtent | null = null;
  const widths = parts.map((p) => {
    if (p === 'spinner') return m.spinnerSize;
    if (p !== 'label') return m.iconSize;
    text = env.text(face.label ?? '', m.font);
    return text.width;
  });
  const gaps = Math.max(0, parts.length - 1) * m.gap;
  const content = widths.reduce((a, b) => a + b, 0) + gaps;
  const width = clampTo(face.iconOnly ? m.height : content + m.padX * 2, c.minWidth, c.maxWidth);
  const height = clampTo(m.height, c.minHeight, c.maxHeight);

  const over = content - (width - m.padX * 2);
  const label = parts.indexOf('label');
  if (over > 0 && label >= 0) widths[label] = Math.max(0, widths[label]! - over);
  const fitted = widths.reduce((a, b) => a + b, 0) + gaps;

  let x = (width - fitted) / 2;
  const laid = parts.map((part, i) => {
    const w = widths[i]!;
    const h = part === 'label' ? m.font.size : part === 'spinner' ? m.spinnerSize : m.iconSize;
    const rect = { x, y: (height - h) / 2, width: w, height: h };
    x += w + m.gap;
    return { part, rect };
  });
  // The label's line height is its font size: the DOM button sets `line-height: 1`.
  const baseline = text ? centeredBaseline(height, m.font.size, text) : height;
  return { width, height, baseline, layout: { parts: laid, metrics: m } };
}

/** Where a press stands: the pointer over the control, and a press held on it. */
export interface PressState {
  readonly hovered: boolean;
  readonly held: boolean;
}

/** Nothing over the control and nothing held. */
export const IDLE_PRESS: PressState = { hovered: false, held: false };

/** One pointer event as a press reads it. `inside` says whether the point is over the control. */
export type PressInput =
  | { type: 'down' }
  | { type: 'move' | 'up'; inside: boolean }
  | { type: 'cancel' | 'enter' | 'leave' };

/** What a pointer event does to a press: the new state, and whether it completed one (released over the control
 *  it went down on). A drag off the control lets go of the hold and a drag back on takes it again, as a native
 *  button's `:active` does. */
export function pressStep(s: PressState, input: PressInput): { state: PressState; pressed: boolean } {
  switch (input.type) {
    case 'down': return { state: { ...s, held: true }, pressed: false };
    case 'move': return { state: s.held === input.inside ? s : { ...s, held: input.inside }, pressed: false };
    case 'up': return { state: { ...s, held: false }, pressed: s.held && input.inside };
    case 'cancel': return { state: { ...s, held: false }, pressed: false };
    case 'enter': return { state: { ...s, hovered: true }, pressed: false };
    case 'leave': return { state: { ...s, hovered: false }, pressed: false };
  }
}

/** Whether a key presses a focused button: Enter or Space, as a native `<button>` takes them. */
export function isPressKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
